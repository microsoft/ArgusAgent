import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type RunnerKind =
  | 'codex'
  | 'claude'
  | 'copilot'
  | 'pi'
  | 'opencode'
  | 'grok'
  | 'qoder'
  | 'dsh';

export const RUNNER_KINDS: RunnerKind[] = [
  'codex',
  'claude',
  'copilot',
  'pi',
  'opencode',
  'grok',
  'qoder',
  'dsh'
];

export const RUNNER_LABELS: Record<RunnerKind, string> = {
  codex: 'Codex CLI',
  claude: 'Claude Code',
  copilot: 'GitHub Copilot CLI',
  pi: 'Pi (follows your Pi model)',
  opencode: 'OpenCode',
  grok: 'Grok Build',
  qoder: 'Qoder CLI',
  dsh: 'DeepSeek Harness'
};

const RUNNER_NAMES: Record<RunnerKind, string[]> = {
  codex: ['codex.cmd', 'codex.exe', 'codex'],
  claude: ['claude.cmd', 'claude.exe', 'claude'],
  copilot: ['copilot.cmd', 'copilot.exe', 'copilot'],
  pi: ['pi.cmd', 'pi.exe', 'pi'],
  opencode: ['opencode.cmd', 'opencode.exe', 'opencode'],
  grok: ['grok.cmd', 'grok.exe', 'grok'],
  qoder: ['qodercli.cmd', 'qodercli.exe', 'qodercli'],
  dsh: ['dsh.cmd', 'dsh.exe', 'dsh']
};

export function isRunnerKind(value: unknown): value is RunnerKind {
  return typeof value === 'string' && RUNNER_KINDS.includes(value as RunnerKind);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function pushIfFile(candidates: string[], path: string): void {
  if (isFile(path)) candidates.push(path);
}

function pushNamed(candidates: string[], dir: string, names: string[]): void {
  if (!dir) return;
  for (const name of names) {
    pushIfFile(candidates, join(dir, name));
  }
}

/** Locate an agent CLI that Python subprocesses can actually spawn. */
export interface RunnerResolutionContext {
  home?: string;
  appData?: string;
  localAppData?: string;
  path?: string;
}

export function resolveRunnerBinary(
  kind: RunnerKind,
  context: RunnerResolutionContext = {}
): string | undefined {
  const home = context.home ?? homedir();
  const names = RUNNER_NAMES[kind];
  const candidates: string[] = [];

  const appData = context.appData ?? process.env.APPDATA ?? '';
  const npmGlobal = appData ? join(appData, 'npm') : '';
  pushNamed(candidates, npmGlobal, names);

  pushNamed(candidates, join(home, '.local', 'bin'), names);

  const localAppData = context.localAppData
    ?? process.env.LOCALAPPDATA
    ?? join(home, 'AppData', 'Local');
  if (kind === 'codex') {
    pushIfFile(candidates, join(localAppData, 'Microsoft', 'WindowsApps', 'codex.exe'));
  } else if (kind === 'claude') {
    pushNamed(candidates, join(localAppData, 'Programs', 'claude-code'), names);
  } else if (kind === 'copilot') {
    pushNamed(candidates, join(localAppData, 'Programs', 'github-copilot-cli'), names);
  } else if (kind === 'opencode') {
    pushNamed(candidates, join(home, '.opencode', 'bin'), names);
    pushNamed(candidates, join(localAppData, 'Programs', 'opencode'), names);
  } else if (kind === 'grok') {
    pushNamed(candidates, join(localAppData, 'Programs', 'grok'), names);
  }

  for (const dir of (context.path ?? process.env.PATH ?? '').split(';')) {
    if (!dir || /WindowsApps/i.test(dir)) continue;
    pushNamed(candidates, dir, names);
  }

  return candidates[0];
}

export interface PiConfiguration {
  configDir: string;
  provider?: string;
  model?: string;
  qualifiedModel?: string;
}

function piConfigDir(): string {
  const home = homedir();
  const configured = (process.env.PI_CODING_AGENT_DIR || '').trim();
  if (!configured) return join(home, '.pi', 'agent');
  if (configured === '~') return home;
  if (configured.startsWith('~/') || configured.startsWith('~\\')) {
    return join(home, configured.slice(2));
  }
  return configured;
}

/** Read Pi's public model selection only; credentials are never opened here. */
export function detectPiConfiguration(): PiConfiguration {
  const configDir = piConfigDir();
  try {
    const parsed = JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf-8')) as {
      defaultProvider?: unknown;
      defaultModel?: unknown;
    };
    const provider = typeof parsed.defaultProvider === 'string'
      ? parsed.defaultProvider.trim()
      : '';
    const model = typeof parsed.defaultModel === 'string'
      ? parsed.defaultModel.trim()
      : '';
    const qualifiedModel = model
      ? (provider && !model.startsWith(`${provider}/`) ? `${provider}/${model}` : model)
      : undefined;
    return {
      configDir,
      provider: provider || undefined,
      model: model || undefined,
      qualifiedModel
    };
  } catch {
    return { configDir };
  }
}

export function detectRunners(
  context: RunnerResolutionContext = {}
): Partial<Record<RunnerKind, string>> {
  const detected: Partial<Record<RunnerKind, string>> = {};
  for (const kind of RUNNER_KINDS) {
    const path = resolveRunnerBinary(kind, context);
    if (path) detected[kind] = path;
  }
  return detected;
}
