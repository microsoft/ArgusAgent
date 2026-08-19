export interface ParentExitGuardOptions {
  platform?: NodeJS.Platform;
  parentPid?: number;
  pollMs?: number;
  isProcessAlive?: (pid: number) => boolean;
  onParentExit?: () => void;
  setIntervalFn?: typeof setInterval;
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Ensure a Windows Ink child cannot outlive its Python/PowerShell launcher.
 *
 * The Python launcher waits for Node during normal exits. A force-terminated
 * PowerShell can bypass that cleanup and orphan Node, so the child also watches
 * its direct parent. The timer is unref'ed and never keeps a normal TUI alive.
 */
export function installParentExitGuard(
  options: ParentExitGuardOptions = {},
): ReturnType<typeof setInterval> | null {
  const platform = options.platform ?? process.platform;
  const parentPid = options.parentPid ?? process.ppid;
  if (platform !== 'win32' || !Number.isInteger(parentPid) || parentPid <= 0) return null;

  const alive = options.isProcessAlive ?? isProcessAlive;
  const exit = options.onParentExit ?? (() => process.exit(0));
  const setTimer = options.setIntervalFn ?? setInterval;
  const timer = setTimer(() => {
    if (!alive(parentPid)) exit();
  }, options.pollMs ?? 1_000);
  timer.unref?.();
  return timer;
}
