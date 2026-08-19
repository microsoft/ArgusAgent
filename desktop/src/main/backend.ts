import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import { delimiter, join, resolve } from 'node:path';
import { app } from 'electron';
import { apiBaseUrl, cockpitUrl, type DesktopSettings } from './settings';
import {
  authenticatedBundledBackendMatches,
  backendLaunchClaimMatches,
  backendOwnershipMatches,
  priorBackendOwnershipMatches,
  type BackendOwnership,
  type BackendProbeIdentity,
} from './backendIdentity';
import { BackendResiliencePolicy } from './backendResilience';
import { terminateWindowsProcessTree } from './backendProcess';
import { redactSensitiveText } from './redaction';
import { RUNNER_LABELS, resolveRunnerBinary } from './runner';
import type { Logger } from './types';

export type BackendState = 'idle' | 'starting' | 'ready' | 'error' | 'stopped';

export interface BackendStatus {
  state: BackendState;
  message: string;
  detail?: string;
  pid?: number;
  url?: string;
}

type BackendProbeFailureKind = 'timeout' | 'network' | 'http' | 'identity';
type BackendProbe = BackendProbeIdentity & { failureKind?: BackendProbeFailureKind };

const INITIAL_PROBE_TIMEOUT_MS = 2_000;
const HEALTH_PROBE_TIMEOUT_MS = 3_000;
const HEALTH_INTERVAL_MS = 5_000;
const RECOVERY_STABLE_RESET_MS = 60_000;

export class BackendSupervisor extends EventEmitter {
  private child: ChildProcess | null = null;
  // The spawned process can be a Windows venv launcher. Keep its ChildProcess
  // separate from the authenticated Python process that actually serves HTTP.
  private runtimePid: number | null = null;
  private state: BackendState = 'idle';
  private logTail: string[] = [];
  private stopping = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private stableTimer: NodeJS.Timeout | null = null;
  private healthGeneration = 0;
  private lifecycleGeneration = 0;
  private reachedReady = false;
  private readonly resilience = new BackendResiliencePolicy();

  constructor(
    private settings: DesktopSettings,
    private readonly log: Logger
  ) {
    super();
  }

  applySettings(next: DesktopSettings): void {
    this.settings = next;
  }

  get currentStatus(): BackendStatus {
    return {
      state: this.state,
      message: this.lastMessage,
      detail: this.lastDetail,
      pid: this.runtimePid ?? this.child?.pid ?? undefined,
      url: this.state === 'ready' ? cockpitUrl(this.settings) : undefined
    };
  }

  private lastMessage = 'idle';
  private lastDetail?: string;

  private emitStatus(): void {
    try {
      this.emit('status', this.currentStatus);
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      // A renderer/listener failure must never take down process supervision.
      this.log.error('backend status listener failed', detail);
    }
  }

  async start(): Promise<void> {
    if (this.state === 'starting' || this.state === 'ready') return;
    const generation = this.lifecycleGeneration;
    this.stopping = false;
    const command = this.resolveCommand().command;
    if (process.env.ARGUS_DESKTOP_DEV !== '1') {
      if (!existsSync(command)) {
        this.setState(
          'error',
          '内置 Argus 后端缺失',
          `未找到 ${command}；请重新安装完整桌面包。`
        );
        return;
      }
      if (!this.bundledManifestDigest()) {
        this.setState(
          'error',
          '无法验证内置 Argus 后端',
          '发布清单缺失或损坏；桌面端不会启动身份不明的后端。'
        );
        return;
      }
    }
    this.setState('starting', '正在检查本地服务');

    const probe = await this.probeForStartup();
    if (this.stopping || generation !== this.lifecycleGeneration) return;
    if (probe.compatible) {
      if (!this.ownershipMatches(probe)) {
        this.setState(
          'error',
          `端口 ${this.settings.port} 已由未受当前桌面进程管理的 Argus 占用`,
          '请先正常退出另一份 Argus；桌面端不会接管或终止无法证明所有权的进程。'
        );
        return;
      }
      this.runtimePid = probe.pid ?? null;
      this.markBackendReady('本地服务已就绪');
      return;
    }
    if (probe.occupied) {
      // An installer update can leave the previous Desktop backend listening
      // while the new Electron host starts. Replace it only after its live API
      // exactly matches this user's prior authenticated ownership record; an
      // arbitrary older Argus or unrelated listener still fails closed.
      if (this.priorOwnershipMatches(probe) || this.legacyBundledBackendMatches(probe)) {
        this.setState('starting', '正在升级受管理的 Argus 本地后端', probe.detail);
        const stopped = await this.stopPriorOwnedBackend(probe);
        if (this.stopping || generation !== this.lifecycleGeneration) return;
        if (!stopped) {
          this.setState(
            'error',
            '无法安全替换上一版本的 Argus 本地后端',
            `${probe.detail || `端口 ${this.settings.port} 仍被占用`}\n旧后端的身份已验证，但其监听进程未能在限定时间内退出；请从旧版 Argus 正常退出后重试。`
          );
          return;
        }
      } else {
        this.setState('error', `端口 ${this.settings.port} 已被其他程序占用`, probe.detail);
        return;
      }
    }

    this.setState('starting', '正在启动 Argus 本地后端');
    try {
      await this.spawnBackend();
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.handleBackendFailure('无法准备 Argus 本地运行环境', detail);
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async stop(): Promise<void> {
    this.lifecycleGeneration += 1;
    this.stopping = true;
    this.cancelPoll();
    this.cancelHealthMonitor();
    this.cancelRecoveryTimers();
    this.resilience.reset();
    this.reachedReady = false;
    await this.terminateOwnedBackend();
    this.setState('stopped', '已停止');
  }

  private cancelPoll(): void {
    if (!this.pollTimer) return;
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  private cancelHealthMonitor(): void {
    this.healthGeneration += 1;
    if (!this.healthTimer) return;
    clearTimeout(this.healthTimer);
    this.healthTimer = null;
  }

  private cancelRecoveryTimers(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }

  private async terminateOwnedBackend(): Promise<void> {
    const child = this.child;
    const launcherPid = child?.pid;
    const runtimePid = this.runtimePid ?? undefined;
    this.child = null;
    this.runtimePid = null;
    // The launcher is the safe root for a process-tree kill. If it has already
    // exited, fall back to the authenticated runtime PID recorded in memory.
    let terminated = true;
    if (launcherPid !== undefined && this.isProcessAlive(launcherPid)) {
      terminated = await this.killTree(launcherPid) && terminated;
    }
    if (
      runtimePid !== undefined
      && runtimePid !== launcherPid
      && this.isProcessAlive(runtimePid)
    ) {
      terminated = await this.killTree(runtimePid) && terminated;
    }
    const launcherDead = launcherPid === undefined || !this.isProcessAlive(launcherPid);
    const runtimeDead = runtimePid === undefined || !this.isProcessAlive(runtimePid);
    if (runtimePid !== undefined && terminated && launcherDead && runtimeDead) {
      this.clearOwnership(runtimePid);
    } else if (runtimePid !== undefined && (!launcherDead || !runtimeDead)) {
      this.log.error(
        'backend process tree remained alive after taskkill; retaining ownership record',
        `launcher_pid=${launcherPid ?? 'none'} runtime_pid=${runtimePid}`
      );
    } else {
      // A forced renderer/main-process shutdown can race the child exit event,
      // leaving a stale ownership record even though the whole process tree is
      // gone.  With no in-memory runtime PID there is nothing safe to signal,
      // but the record may still be removed after proving its recorded PIDs are
      // no longer alive.  Never remove a live or unreadable ownership claim.
      this.clearDeadOwnership();
    }
  }

  private setState(state: BackendState, message: string, detail?: string): void {
    this.state = state;
    this.lastMessage = message;
    this.lastDetail = detail;
    this.log.info(`backend ${state}: ${message}`, detail ?? '');
    this.emitStatus();
  }

  private markBackendReady(message: string): void {
    this.reachedReady = true;
    this.resilience.recordHealthSuccess();
    this.setState('ready', message);
    this.armStableRecoveryReset();
    this.startHealthMonitor();
  }

  private armStableRecoveryReset(): void {
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.stableTimer = null;
    if (this.resilience.restartAttemptCount === 0) return;
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null;
      const attempts = this.resilience.restartAttemptCount;
      this.resilience.markRuntimeStable();
      this.log.info(`backend remained healthy; reset automatic recovery circuit after ${attempts} attempt(s)`);
    }, RECOVERY_STABLE_RESET_MS);
  }

  private handleBackendFailure(message: string, detail: string): void {
    if (this.stopping) return;
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    if (this.reachedReady) {
      this.scheduleAutomaticRecovery(detail);
      return;
    }
    this.setState('error', message, detail);
  }

  private scheduleAutomaticRecovery(detail: string): void {
    if (this.stopping || this.recoveryTimer) return;
    const decision = this.resilience.beginAutomaticRecovery();
    if (!decision.allowed) {
      this.setState(
        'error',
        'Argus 本地服务无法自动恢复',
        `${detail}\n已完成 ${decision.attempts}/${decision.maxAttempts} 次自动恢复；请检查诊断信息后手动重试。`
      );
      return;
    }

    this.cancelPoll();
    this.cancelHealthMonitor();
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    this.setState(
      'starting',
      `本地服务短暂中断，正在自动恢复（${decision.attempt}/${decision.maxAttempts}）`,
      detail
    );
    this.log.warn(
      `backend automatic recovery scheduled attempt=${decision.attempt}/${decision.maxAttempts} delay_ms=${decision.delayMs}`
    );
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      void this.performAutomaticRecovery(detail);
    }, decision.delayMs);
  }

  private async performAutomaticRecovery(previousDetail: string): Promise<void> {
    if (this.stopping) return;
    const generation = this.lifecycleGeneration;
    this.stopping = true;
    try {
      this.cancelPoll();
      this.cancelHealthMonitor();
      await this.terminateOwnedBackend();
      if (generation !== this.lifecycleGeneration) return;
      this.stopping = false;
      // start() deliberately ignores an already-starting state. Reset only the
      // internal state here; the user-facing status remains "自动恢复" until
      // start() emits its next verified transition.
      this.state = 'idle';
      await this.start();
    } catch (error) {
      if (generation !== this.lifecycleGeneration) return;
      this.stopping = false;
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.scheduleAutomaticRecovery(`${previousDetail}\n${detail}`);
    } finally {
      if (generation === this.lifecycleGeneration) this.stopping = false;
    }
  }

  private async probeForStartup(): Promise<BackendProbe> {
    let probe = await this.probe(INITIAL_PROBE_TIMEOUT_MS);
    // If nothing is listening, spawning immediately is correct. Retry only an
    // occupied-but-slow port so a transient scheduling stall does not turn an
    // owned backend from a previous Desktop instance into a false conflict.
    for (const delayMs of [250, 750]) {
      if (
        this.stopping
        || !probe.occupied
        || probe.failureKind === 'identity'
      ) break;
      await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, delayMs));
      if (this.stopping) break;
      probe = await this.probe(INITIAL_PROBE_TIMEOUT_MS);
    }
    return probe;
  }

  private async probe(timeoutMs: number): Promise<BackendProbe> {
    const base = apiBaseUrl(this.settings);
    let response: Response;
    try {
      response = await fetch(`${base}/api/meta`, {
        headers: { Authorization: `Bearer ${this.settings.token}` },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      const occupied = await this.portOccupied();
      const timedOut = error instanceof Error
        && (error.name === 'TimeoutError' || error.name === 'AbortError');
      return {
        compatible: false,
        occupied,
        failureKind: timedOut ? 'timeout' : 'network',
        detail: occupied
          ? `本地服务端口仍在监听，但健康检查在 ${timeoutMs}ms 内未完成`
          : `本地服务暂时不可达${timedOut ? `（${timeoutMs}ms 超时）` : ''}`
      };
    }

    if (!response.ok) {
      return {
        compatible: false,
        occupied: true,
        failureKind: 'http',
        detail: `本地服务健康检查返回 HTTP ${response.status}`
      };
    }

    let body: {
      authentication?: {
        authenticated?: boolean;
      };
      runtime?: {
        package_version?: string;
        release_id?: string;
        manifest_source_digest?: string;
        executable?: string;
        pid?: number;
        started_at?: string;
        desktop_launch_nonce?: string;
      };
    };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      return {
        compatible: false,
        occupied: true,
        failureKind: 'identity',
        detail: '端口上的服务返回了无法验证的 Argus 身份数据'
      };
    }

    const runtime = body.runtime;
    if (body.authentication?.authenticated !== true) {
      return {
        compatible: false,
        occupied: true,
        failureKind: 'identity',
        detail: '端口上的服务未通过当前 Argus 桌面端身份认证'
      };
    }
    if (
      !runtime?.package_version
      || !runtime.executable
      || !runtime.pid
      || !runtime.started_at
    ) {
      return {
        compatible: false,
        occupied: true,
        failureKind: 'identity',
        detail: '端口上的服务缺少当前 Argus 桌面运行身份'
      };
    }
    const respondingIdentity = {
      authenticated: true,
      pid: runtime.pid,
      executable: runtime.executable,
      manifestSourceDigest: runtime.manifest_source_digest,
      startedAt: runtime.started_at,
      launchNonce: runtime.desktop_launch_nonce
    };
    if (process.env.ARGUS_DESKTOP_DEV !== '1') {
      const expectedExecutable = resolve(this.resolveCommand().command).toLowerCase();
      const actualExecutable = resolve(runtime.executable).toLowerCase();
      if (actualExecutable !== expectedExecutable) {
        return {
          compatible: false,
          occupied: true,
          failureKind: 'identity',
          detail: `端口由另一份 Argus 占用：${runtime.executable}`,
          ...respondingIdentity
        };
      }
      if (runtime.package_version !== app.getVersion()) {
        return {
          compatible: false,
          occupied: true,
          failureKind: 'identity',
          detail: `端口上的 Argus 版本为 ${runtime.package_version}，当前桌面版为 ${app.getVersion()}`,
          ...respondingIdentity
        };
      }
      const expectedDigest = this.expectedManifestDigest();
      if (!expectedDigest || runtime.manifest_source_digest !== expectedDigest) {
        return {
          compatible: false,
          occupied: true,
          failureKind: 'identity',
          detail: '端口上的 Argus 后端不是当前桌面构建',
          ...respondingIdentity
        };
      }
    }
    return {
      compatible: true,
      occupied: false,
      ...respondingIdentity
    };
  }

  private portOccupied(): Promise<boolean> {
    return new Promise((resolveProbe) => {
      const socket = createConnection({
        host: this.settings.host,
        port: this.settings.port
      });
      let settled = false;
      const finish = (occupied: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolveProbe(occupied);
      };
      socket.setTimeout(500);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
    });
  }

  private tokenSha256(): string {
    return createHash('sha256').update(this.settings.token, 'utf-8').digest('hex');
  }

  private bundledManifestDigest(): string | null {
    try {
      const manifest = join(
        process.resourcesPath,
        'argus-backend',
        '_internal',
        'argus_skill',
        'release_manifest.json'
      );
      const payload = JSON.parse(readFileSync(manifest, 'utf-8')) as {
        source_digest?: unknown;
      };
      const value = typeof payload.source_digest === 'string'
        ? payload.source_digest.trim()
        : '';
      return value || null;
    } catch {
      return null;
    }
  }

  private expectedManifestDigest(): string | null {
    const bundled = this.bundledManifestDigest();
    if (bundled || process.env.ARGUS_DESKTOP_DEV !== '1') return bundled;
    try {
      const manifest = join(this.resolveCommand().cwd, 'argus_skill', 'release_manifest.json');
      const payload = JSON.parse(readFileSync(manifest, 'utf-8')) as {
        source_digest?: unknown;
      };
      return typeof payload.source_digest === 'string'
        ? payload.source_digest.trim() || null
        : null;
    } catch {
      return null;
    }
  }

  private resolveCommand(): { command: string; args: string[]; cwd: string } {
    if (process.env.ARGUS_DESKTOP_DEV === '1') {
      const repoRoot = process.env.ARGUS_DESKTOP_REPO_ROOT || resolve(app.getAppPath(), '..');
      return {
        command: process.env.ARGUS_SKILL_BIN || 'python',
        args: ['-m', 'argus_skill', '--web', '--web-host', this.settings.host, '--web-port', String(this.settings.port)],
        cwd: repoRoot
      };
    }
    return {
      command: join(process.resourcesPath, 'argus-backend', 'argus-backend.exe'),
      args: ['--web', '--web-host', this.settings.host, '--web-port', String(this.settings.port)],
      cwd: app.getPath('userData')
    };
  }

  private ensureRuntimeCommandShims(command: string): string | null {
    if (process.env.ARGUS_DESKTOP_DEV === '1') return null;
    const runtimeBin = join(app.getPath('userData'), 'runtime', 'bin');
    mkdirSync(runtimeBin, { recursive: true });
    const escapedCommand = command.replaceAll('%', '%%');
    const cmdBody = `@echo off\r\n"${escapedCommand}" %*\r\n`;
    for (const name of ['python.cmd', 'python3.cmd']) {
      writeFileSync(join(runtimeBin, name), cmdBody, 'utf-8');
    }
    // Pi/Codex commonly run commands through Git Bash on Windows. Bash doesn't
    // resolve PATHEXT, so ``python.cmd`` alone leaves every bare ``python -m
    // argus_skill...`` example pointing at an unrelated system interpreter.
    // Extensionless POSIX shims and CMD shims together cover both shell families.
    const shellCommand = command
      .replaceAll('\\', '/')
      .replaceAll("'", "'\"'\"'");
    const shellBody = `#!/bin/sh\nexec '${shellCommand}' \"$@\"\n`;
    for (const name of ['python', 'python3']) {
      writeFileSync(join(runtimeBin, name), shellBody, 'utf-8');
    }
    return runtimeBin;
  }

  private async spawnBackend(): Promise<void> {
    const { command, args, cwd } = this.resolveCommand();
    this.ensureSpecialPrompts();
    const runtimeBin = this.ensureRuntimeCommandShims(command);
    const manifestSourceDigest = this.expectedManifestDigest();
    if (!manifestSourceDigest) {
      throw new Error('Argus backend release manifest is missing or invalid');
    }
    const launchNonce = randomBytes(32).toString('base64url');
    const runnerKind = this.settings.runnerKind;
    const runnerBin = this.settings.runnerBins[runnerKind]
      || process.env.ARGUS_SKILL_RUNNER_BIN
      || resolveRunnerBinary(runnerKind);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ARGUS_BINARY_DISTRIBUTION: '1',
      ARGUS_BINARY_MODE: 'cli',
      ARGUS_SKILL_BIN: command,
      ARGUS_SKILL_PYTHON: command,
      ARGUS_SKILL_WEB_TOKEN: this.settings.token,
      ARGUS_DESKTOP_LAUNCH_NONCE: launchNonce,
      ARGUS_SKILL_HOME: process.env.ARGUS_SKILL_HOME || join(app.getPath('home'), '.argus-skill'),
      PYTHONUTF8: process.env.PYTHONUTF8 || '1',
      PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8',
      ...(runtimeBin
        ? {
            ARGUS_SKILL_RUNTIME_BIN: runtimeBin,
            PATH: [runtimeBin, process.env.PATH || ''].filter(Boolean).join(delimiter)
          }
        : {})
    };
    if (this.settings.runnerConfigured) {
      env.ARGUS_SKILL_RUNNER_BACKEND = runnerKind;
    }
    if (runnerBin) {
      env.ARGUS_SKILL_RUNNER_BIN = runnerBin;
      this.log.info(`resolved runner binary: ${runnerBin}`);
    } else {
      this.log.warn(
        `no ${RUNNER_LABELS[runnerKind]} binary found; configure ARGUS_SKILL_RUNNER_BIN or install ${RUNNER_LABELS[runnerKind]}`
      );
    }

    this.logTail = [];
    const spawnedAtMs = Date.now();
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    this.child = child;
    this.runtimePid = null;
    child.stdout?.on('data', (chunk: Buffer) => this.appendLog(chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.appendLog(chunk));
    child.once('error', (error) => {
      if (this.child !== child || this.stopping) return;
      this.child = null;
      this.runtimePid = null;
      this.handleBackendFailure(
        '无法启动 Argus 本地后端',
        `${error.name}: ${error.message}`
      );
    });
    child.once('exit', (code, signal) => {
      const runtimePid = this.runtimePid;
      const wasCurrent = this.child === child;
      if (this.child === child) this.child = null;
      if (wasCurrent) this.runtimePid = null;
      if (!this.stopping && wasCurrent) {
        this.cancelHealthMonitor();
        const detail = [
          `exit code: ${code ?? 'none'}`,
          `signal: ${signal ?? 'none'}`,
          ...this.logTail.slice(-8)
        ].join('\n');
        const reportFailure = (): void => this.handleBackendFailure(
          this.reachedReady ? 'Argus 本地后端意外退出' : '本地后端启动失败',
          detail
        );
        if (
          runtimePid !== null
          && runtimePid !== child.pid
          && this.isProcessAlive(runtimePid)
        ) {
          void this.killTree(runtimePid).then((stopped) => {
            if (stopped) this.clearOwnership(runtimePid);
            else this.log.error(
              'orphaned backend runtime remained alive; retaining ownership record',
              `runtime_pid=${runtimePid}`
            );
          }).finally(reportFailure);
        } else {
          if (runtimePid !== null) this.clearOwnership(runtimePid);
          else this.clearDeadOwnership();
          reportFailure();
        }
      } else if (runtimePid !== null && !this.isProcessAlive(runtimePid)) {
        this.clearOwnership(runtimePid);
      } else {
        this.clearDeadOwnership();
      }
    });
    void this.waitUntilReady(child, {
      launchNonce,
      manifestSourceDigest,
      spawnedAtMs,
    }).catch((error) => {
      if (this.stopping || this.child !== child) return;
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.log.error('backend readiness monitor failed', detail);
      this.handleBackendFailure('本地后端就绪检查失败', detail);
    });
  }

  private ensureSpecialPrompts(): void {
    const promptsDir = process.env.ARGUS_SKILL_SPECIAL_PROMPTS_DIR
      || join(
        process.env.ARGUS_SKILL_HOME || join(app.getPath('home'), '.argus-skill'),
        'special_prompts'
      );
    const file = join(promptsDir, '10-house-rules.md');
    if (existsSync(file)) return;
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(file, 'Operational house rules for this machine.\n', 'utf-8');
    this.log.info(`created default operator prompts at ${file}`);
  }

  private appendLog(chunk: Buffer): void {
    const safeText = redactSensitiveText(chunk.toString('utf-8'));
    const lines = safeText.split(/\r?\n/).filter(Boolean);
    this.logTail.push(...lines);
    if (this.logTail.length > 200) this.logTail.splice(0, this.logTail.length - 200);
    this.log.verbose('backend output', lines.join('\n'));
  }

  private async waitUntilReady(
    child: ChildProcess,
    launch: {
      launchNonce: string;
      manifestSourceDigest: string;
      spawnedAtMs: number;
    }
  ): Promise<void> {
    const deadline = Date.now() + 30_000;
    let lastDetail = '';

    const fail = async (detail: string): Promise<void> => {
      this.pollTimer = null;
      const runtimePid = this.runtimePid;
      if (this.child === child) this.child = null;
      this.runtimePid = null;
      let terminated = true;
      if (child.pid !== undefined && this.isProcessAlive(child.pid)) {
        terminated = await this.killTree(child.pid) && terminated;
      }
      if (
        runtimePid !== null
        && runtimePid !== child.pid
        && this.isProcessAlive(runtimePid)
      ) {
        terminated = await this.killTree(runtimePid) && terminated;
      }
      const launcherDead = child.pid === undefined || !this.isProcessAlive(child.pid);
      const runtimeDead = runtimePid === null || !this.isProcessAlive(runtimePid);
      if (runtimePid !== null && terminated && launcherDead && runtimeDead) {
        this.clearOwnership(runtimePid);
      } else if (!launcherDead || !runtimeDead) {
        this.log.error(
          'timed-out backend remained alive; retaining ownership for recovery',
          `launcher_pid=${child.pid ?? 'none'} runtime_pid=${runtimePid ?? 'none'}`
        );
      }
      this.handleBackendFailure('本地后端启动超时', detail);
    };

    const poll = async (): Promise<void> => {
      if (this.stopping || this.child !== child) return;
      try {
        const probe = await this.probe(INITIAL_PROBE_TIMEOUT_MS);
        lastDetail = probe.detail || lastDetail;
        if (backendLaunchClaimMatches(probe, launch)) {
          const runtimePid = probe.pid!;
          const executable = probe.executable!;
          const startedAt = probe.startedAt!;
          // Retain the authenticated runtime PID even if ownership persistence
          // fails, so timeout cleanup still knows the exact listener process.
          this.runtimePid = runtimePid;
          this.writeOwnership(
            runtimePid,
            child.pid ?? runtimePid,
            executable,
            startedAt,
          );
          if (this.ownershipMatches(probe)) {
            this.runtimePid = runtimePid;
            this.pollTimer = null;
            this.markBackendReady('Argus 桌面端已就绪');
            return;
          }
          // Keep the authenticated launch claim until the process is proven
          // dead. If cleanup later fails, deleting it would turn an owned
          // listener into an unmanageable port conflict.
          lastDetail = '本地后端身份记录未能通过完整性校验';
        } else if (probe.compatible) {
          lastDetail = '响应端未能证明它属于本次桌面端启动';
        }
      } catch (error) {
        lastDetail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        this.log.warn(`backend readiness probe failed internally; retrying: ${lastDetail}`);
      }

      if (Date.now() > deadline) {
        await fail(lastDetail || this.logTail.slice(-8).join('\n'));
        return;
      }
      this.pollTimer = setTimeout(() => {
        this.pollTimer = null;
        void poll();
      }, 500);
    };
    await poll();
  }

  private startHealthMonitor(): void {
    this.cancelHealthMonitor();
    const generation = this.healthGeneration;

    const schedule = (delayMs: number): void => {
      if (
        generation !== this.healthGeneration
        || this.stopping
        || this.state !== 'ready'
      ) return;
      this.healthTimer = setTimeout(() => {
        this.healthTimer = null;
        void check().catch((error) => {
          if (
            generation !== this.healthGeneration
            || this.stopping
            || this.state !== 'ready'
          ) return;
          const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
          this.log.warn(`backend health monitor internal error; retrying: ${detail}`);
          schedule(1_000);
        });
      }, delayMs);
    };

    const check = async (): Promise<void> => {
      if (
        generation !== this.healthGeneration
        || this.stopping
        || this.state !== 'ready'
      ) return;

      const probe = await this.probe(HEALTH_PROBE_TIMEOUT_MS);
      if (
        generation !== this.healthGeneration
        || this.stopping
        || this.state !== 'ready'
      ) return;

      const ownershipMatches = probe.compatible && this.ownershipMatches(probe);
      if (probe.compatible && ownershipMatches) {
        const previousFailures = this.resilience.healthFailureCount;
        this.resilience.recordHealthSuccess();
        if (previousFailures > 0) {
          this.log.info(`backend health recovered after ${previousFailures} transient failure(s)`);
          this.armStableRecoveryReset();
        }
        schedule(HEALTH_INTERVAL_MS);
        return;
      }

      if (this.stableTimer) {
        clearTimeout(this.stableTimer);
        this.stableTimer = null;
      }
      const pid = this.runtimePid ?? this.child?.pid ?? undefined;
      const processAlive = pid !== undefined && this.isProcessAlive(pid);
      const identityConflict = probe.failureKind === 'identity'
        || (probe.compatible && !ownershipMatches);
      const decision = this.resilience.recordHealthFailure({
        identityConflict,
        processAlive
      });
      const detail = probe.detail
        || `127.0.0.1:${this.settings.port} 暂时未响应当前桌面构建`;

      if (decision.action === 'retry') {
        this.log.warn(
          `backend health probe transient failure count=${decision.failureCount} retry_ms=${decision.delayMs}: ${detail}`
        );
        schedule(decision.delayMs);
        return;
      }

      this.cancelHealthMonitor();
      if (decision.action === 'fail') {
        this.setState(
          'error',
          'Argus 本地后端身份验证失败',
          `${detail}\n桌面端不会接管、重启或终止无法证明所有权的进程。`
        );
        return;
      }

      this.log.warn(
        `backend health confirmed unavailable after ${decision.failureCount} failure(s): ${detail}`
      );
      this.scheduleAutomaticRecovery(detail);
    };

    schedule(HEALTH_INTERVAL_MS);
  }

  private readOwnership(): Partial<BackendOwnership> | null {
    try {
      const file = join(app.getPath('userData'), 'runtime', 'backend.json');
      const payload = JSON.parse(readFileSync(file, 'utf-8')) as Partial<BackendOwnership>;
      return payload && typeof payload === 'object' ? payload : null;
    } catch {
      return null;
    }
  }

  private ownershipMatches(probe: BackendProbe): boolean {
    if (!probe.pid) return false;
    const manifestSourceDigest = this.expectedManifestDigest();
    const ownership = this.readOwnership();
    if (!manifestSourceDigest || ownership === null) return false;
    return backendOwnershipMatches(ownership, probe, {
      host: this.settings.host,
      port: this.settings.port,
      executable: process.env.ARGUS_DESKTOP_DEV === '1' && probe.executable
        ? resolve(probe.executable)
        : resolve(this.resolveCommand().command),
      manifestSourceDigest,
      tokenSha256: this.tokenSha256()
    });
  }

  private priorOwnershipMatches(probe: BackendProbe): boolean {
    const ownership = this.readOwnership();
    if (ownership === null) return false;
    return priorBackendOwnershipMatches(ownership, probe, {
      host: this.settings.host,
      port: this.settings.port,
      tokenSha256: this.tokenSha256()
    });
  }

  /**
   * Support an in-place installer upgrade from an older Desktop build whose
   * ownership record is absent or predates schema 3. The token-authenticated
   * listener must still report the exact executable path bundled by this app.
   */
  private legacyBundledBackendMatches(probe: BackendProbe): boolean {
    if (process.env.ARGUS_DESKTOP_DEV === '1') return false;
    return authenticatedBundledBackendMatches(probe, {
      executable: resolve(this.resolveCommand().command)
    });
  }

  /** Replace only an authenticated previous-release listener from this Desktop install. */
  private async stopPriorOwnedBackend(probe: BackendProbe): Promise<boolean> {
    const runtimePid = probe.pid;
    const ownedPrior = this.priorOwnershipMatches(probe);
    const legacyBundled = this.legacyBundledBackendMatches(probe);
    if (!runtimePid || (!ownedPrior && !legacyBundled)) return false;
    this.log.info(
      `replacing ${ownedPrior ? 'owned' : 'legacy bundled'} desktop backend pid=${runtimePid} on ${this.settings.host}:${this.settings.port}`
    );
    if (this.isProcessAlive(runtimePid) && !(await this.killTree(runtimePid))) {
      return false;
    }
    // Do not signal a distinct historical launcher PID: the authenticated API
    // proves the listener, not a PID which may have been reused after the old
    // launcher exited. Killing the listener's tree is sufficient to free the
    // port and preserves the no-unknown-process ownership boundary.
    this.clearOwnership(runtimePid);
    const deadline = Date.now() + 5_000;
    while (await this.portOccupied()) {
      if (Date.now() >= deadline) return false;
      await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 100));
    }
    return true;
  }

  private writeOwnership(
    pid: number | undefined,
    rootPid: number | undefined,
    command: string,
    startedAt = new Date().toISOString(),
  ): void {
    if (!pid || !rootPid || !existsSync(command)) return;
    const manifestSourceDigest = this.expectedManifestDigest();
    if (!manifestSourceDigest) return;
    const file = join(app.getPath('userData'), 'runtime', 'backend.json');
    mkdirSync(join(app.getPath('userData'), 'runtime'), { recursive: true });
    const ownership: BackendOwnership = {
      schema: 3,
      pid,
      rootPid,
      host: this.settings.host,
      port: this.settings.port,
      executable: resolve(command),
      manifestSourceDigest,
      tokenSha256: this.tokenSha256(),
      startedAt
    };
    writeFileSync(file, JSON.stringify(ownership, null, 2), 'utf-8');
  }

  private clearOwnership(expectedPid?: number): void {
    try {
      const file = join(app.getPath('userData'), 'runtime', 'backend.json');
      if (expectedPid !== undefined) {
        const payload = JSON.parse(readFileSync(file, 'utf-8')) as {
          pid?: unknown;
        };
        if (payload.pid !== expectedPid) return;
      }
      rmSync(file, { force: true });
    } catch {
      // Best effort only. Never delete an ownership record we could not prove.
    }
  }

  private clearDeadOwnership(): void {
    try {
      const file = join(app.getPath('userData'), 'runtime', 'backend.json');
      const payload = JSON.parse(readFileSync(file, 'utf-8')) as {
        pid?: unknown;
        rootPid?: unknown;
      };
      const pids = [payload.pid, payload.rootPid].filter(
        (value): value is number => (
          typeof value === 'number' && Number.isInteger(value) && value > 0
        )
      );
      if (pids.length === 0 || pids.some((pid) => this.isProcessAlive(pid))) return;
      rmSync(file, { force: true });
    } catch {
      // Fail closed: malformed or unreadable ownership stays available for
      // operator diagnosis instead of being silently discarded.
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // EPERM still proves the process exists; it only denies signalling it.
      return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
  }

  private killTree(pid: number): Promise<boolean> {
    return terminateWindowsProcessTree(pid, {
      isAlive: (targetPid) => this.isProcessAlive(targetPid),
    });
  }
}
