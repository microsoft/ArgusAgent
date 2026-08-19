import { ApiClient } from './api.js';
import type { ExitPolicy } from './args.js';
import {
  cleanupSpawnedApi,
  type EnsureResult,
  type SpawnedApiCleanupResult,
} from './ensureApi.js';

export interface ExitCleanupSummary {
  daemonStopped: boolean;
  apiStopped: boolean;
  warnings: string[];
}

export interface InteractiveExitLifecycleOptions {
  host: string;
  port: number;
  token?: string;
  policy: ExitPolicy;
  dependencies?: {
    stopDaemon?: (sid: string) => Promise<void>;
    cleanupApi?: (result: EnsureResult) => Promise<SpawnedApiCleanupResult>;
  };
}

/**
 * Coordinates cleanup across Boot, FirstRun, ResumePicker, and App.
 *
 * A result is "accepted" only after Boot is still mounted and has observed the
 * ensureApi result. If the user exits while ensureApi is in flight, a backend
 * which comes online afterwards is always reclaimed, even under detach: no UI
 * ever attached to it, so leaving it behind would be an accidental orphan.
 */
export class InteractiveExitLifecycle {
  private readonly opts: InteractiveExitLifecycleOptions;
  private ensurePromise: Promise<EnsureResult> | null = null;
  private acceptedResult: EnsureResult | null = null;
  private currentSid: string | null = null;
  private readonly pendingDaemonCreations = new Set<Promise<{ sid: string }>>();
  private cleanupPromise: Promise<ExitCleanupSummary> | null = null;

  constructor(opts: InteractiveExitLifecycleOptions) {
    this.opts = opts;
  }

  trackEnsure(promise: Promise<EnsureResult>): void {
    this.ensurePromise = promise;
  }

  acceptEnsureResult(result: EnsureResult): void {
    this.acceptedResult = result;
  }

  setCurrentProject(sid: string | null): void {
    this.currentSid = sid?.trim() || null;
  }

  /**
   * Register daemon creation before awaiting it in the UI.
   *
   * Creation is a server-side operation and cannot be cancelled by unmounting
   * Ink.  Keeping the promise here lets stop-all wait for a late response and
   * stop the daemon it actually created instead of stopping the previously
   * selected project (or nothing at all).
   */
  trackDaemonCreation<T extends { sid: string }>(promise: Promise<T>): Promise<T> {
    const tracked = promise.then((created) => {
      this.setCurrentProject(created.sid);
      return created;
    });
    this.pendingDaemonCreations.add(tracked);
    void tracked.finally(() => {
      this.pendingDaemonCreations.delete(tracked);
    }).catch(() => {
      // The caller owns the creation error.  This branch only observes cleanup
      // of the Set and must not create a second unhandled rejection.
    });
    return tracked;
  }

  cleanup(): Promise<ExitCleanupSummary> {
    if (!this.cleanupPromise) this.cleanupPromise = this.performCleanup();
    return this.cleanupPromise;
  }

  private async performCleanup(): Promise<ExitCleanupSummary> {
    const summary: ExitCleanupSummary = {
      daemonStopped: false,
      apiStopped: false,
      warnings: [],
    };
    let ensured: EnsureResult | null = null;
    if (this.ensurePromise) {
      try {
        ensured = await this.ensurePromise;
      } catch (error) {
        summary.warnings.push(`backend startup cleanup could not inspect its result: ${(error as Error).message}`);
      }
    }

    // A Ctrl-C can unmount Boot/FirstRun/App while POST /api/daemons is still
    // running.  Wait for every creation already registered by those surfaces;
    // trackDaemonCreation updates currentSid without touching unmounted UI.
    while (this.pendingDaemonCreations.size > 0) {
      await Promise.allSettled([...this.pendingDaemonCreations]);
    }

    if (this.opts.policy === 'stop-all' && this.currentSid) {
      try {
        const stopDaemon = this.opts.dependencies?.stopDaemon ?? (async (sid: string) => {
          await new ApiClient({
            host: this.opts.host,
            port: this.opts.port,
            project: sid,
            token: this.opts.token,
          }).stopDaemon();
        });
        await stopDaemon(this.currentSid);
        summary.daemonStopped = true;
      } catch (error) {
        summary.warnings.push(`could not gracefully stop executor ${this.currentSid}: ${(error as Error).message}`);
      }
    }

    const startupFinishedAfterExit = Boolean(
      ensured?.spawnedApi && this.acceptedResult !== ensured,
    );
    const policyStopsApi = this.opts.policy === 'stop-api' || this.opts.policy === 'stop-all';
    if (ensured?.spawnedApi && (startupFinishedAfterExit || policyStopsApi)) {
      try {
        const cleanupApi = this.opts.dependencies?.cleanupApi
          ?? ((result: EnsureResult) => cleanupSpawnedApi({ result, token: this.opts.token }));
        const result = await cleanupApi(ensured);
        summary.apiStopped = result.stopped;
        if (!result.stopped) summary.warnings.push(result.message);
      } catch (error) {
        summary.warnings.push(`could not safely stop owned API: ${(error as Error).message}`);
      }
    }
    return summary;
  }
}
