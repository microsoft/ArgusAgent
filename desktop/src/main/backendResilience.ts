export interface BackendResilienceOptions {
  transientFailureThreshold: number;
  healthRetryDelaysMs: readonly number[];
  automaticRestartDelaysMs: readonly number[];
}

export const DEFAULT_BACKEND_RESILIENCE_OPTIONS: BackendResilienceOptions = {
  // A single loopback request can be delayed by Electron/Windows scheduling.
  // Three failed samples keep the user out of a false crash screen while still
  // detecting a genuinely wedged service in a bounded amount of time.
  transientFailureThreshold: 3,
  healthRetryDelaysMs: [1_000, 2_000],
  automaticRestartDelaysMs: [500, 1_500, 4_000]
};

export interface HealthFailureObservation {
  identityConflict: boolean;
  processAlive: boolean;
}

export type HealthDecision =
  | { action: 'fail'; failureCount: number }
  | { action: 'recover'; failureCount: number }
  | { action: 'retry'; failureCount: number; delayMs: number };

export type AutomaticRecoveryDecision =
  | { allowed: true; attempt: number; maxAttempts: number; delayMs: number }
  | { allowed: false; attempts: number; maxAttempts: number };

/**
 * Pure state machine for backend health and crash-loop containment.
 *
 * The supervisor owns timers and processes; this class only decides whether a
 * sample should be ignored, retried, recovered, or surfaced to the operator.
 */
export class BackendResiliencePolicy {
  private consecutiveHealthFailures = 0;
  private automaticRestartAttempts = 0;

  constructor(
    private readonly options: BackendResilienceOptions = DEFAULT_BACKEND_RESILIENCE_OPTIONS
  ) {
    if (options.transientFailureThreshold < 1) {
      throw new RangeError('transientFailureThreshold must be at least 1');
    }
    if (options.automaticRestartDelaysMs.length < 1) {
      throw new RangeError('automaticRestartDelaysMs must not be empty');
    }
  }

  get healthFailureCount(): number {
    return this.consecutiveHealthFailures;
  }

  get restartAttemptCount(): number {
    return this.automaticRestartAttempts;
  }

  get maxAutomaticRestarts(): number {
    return this.options.automaticRestartDelaysMs.length;
  }

  recordHealthSuccess(): void {
    this.consecutiveHealthFailures = 0;
  }

  recordHealthFailure(observation: HealthFailureObservation): HealthDecision {
    if (observation.identityConflict) {
      return {
        action: 'fail',
        failureCount: this.consecutiveHealthFailures + 1
      };
    }

    this.consecutiveHealthFailures += 1;
    const failureCount = this.consecutiveHealthFailures;

    // A proven-dead owned PID is not a network hiccup. Recover immediately.
    if (!observation.processAlive) {
      this.consecutiveHealthFailures = 0;
      return { action: 'recover', failureCount };
    }

    if (failureCount >= this.options.transientFailureThreshold) {
      this.consecutiveHealthFailures = 0;
      return { action: 'recover', failureCount };
    }

    const delayIndex = Math.min(
      failureCount - 1,
      Math.max(0, this.options.healthRetryDelaysMs.length - 1)
    );
    const delayMs = this.options.healthRetryDelaysMs[delayIndex] ?? 1_000;
    return { action: 'retry', failureCount, delayMs };
  }

  beginAutomaticRecovery(): AutomaticRecoveryDecision {
    const maxAttempts = this.maxAutomaticRestarts;
    if (this.automaticRestartAttempts >= maxAttempts) {
      return {
        allowed: false,
        attempts: this.automaticRestartAttempts,
        maxAttempts
      };
    }

    const attempt = this.automaticRestartAttempts + 1;
    this.automaticRestartAttempts = attempt;
    return {
      allowed: true,
      attempt,
      maxAttempts,
      delayMs: this.options.automaticRestartDelaysMs[attempt - 1] ?? 0
    };
  }

  markRuntimeStable(): void {
    this.consecutiveHealthFailures = 0;
    this.automaticRestartAttempts = 0;
  }

  reset(): void {
    this.markRuntimeStable();
  }
}
