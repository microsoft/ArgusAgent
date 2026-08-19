export type NavigationOutcome = 'loaded' | 'superseded';

export interface NavigationRetryOptions {
  retryDelaysMs?: readonly number[];
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** Electron reports transient/superseded local navigations as -2 or -3. */
export function isRetryableNavigationError(error: unknown): boolean {
  const text = errorText(error);
  return (
    /ERR_FAILED\s*\(-2\)/i.test(text)
    || /ERR_ABORTED\s*\(-3\)/i.test(text)
  );
}

const sleep = (delayMs: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});

/**
 * Serialises intent rather than network work: a newer destination supersedes
 * retries from an older one, preventing launcher/cockpit navigation races.
 */
export class LatestNavigation {
  private revision = 0;

  cancel(): void {
    this.revision += 1;
  }

  async run(
    navigate: () => Promise<unknown>,
    options: NavigationRetryOptions = {}
  ): Promise<NavigationOutcome> {
    const revision = ++this.revision;
    const retryDelaysMs = options.retryDelaysMs ?? [120, 400];

    for (let attempt = 0; ; attempt += 1) {
      try {
        await navigate();
        return revision === this.revision ? 'loaded' : 'superseded';
      } catch (error) {
        if (revision !== this.revision) return 'superseded';
        const delayMs = retryDelaysMs[attempt];
        if (delayMs === undefined || !isRetryableNavigationError(error)) throw error;
        await sleep(delayMs);
        if (revision !== this.revision) return 'superseded';
      }
    }
  }
}
