import { spawn } from 'node:child_process';

export interface ProcessTreeKiller {
  once: (event: 'error' | 'exit', listener: (...args: any[]) => void) => unknown;
}

export interface ProcessTreeTerminationOptions {
  isAlive: (pid: number) => boolean;
  spawnTreeKiller?: (pid: number) => ProcessTreeKiller;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/** Terminate one Windows process tree and verify its root actually died. */
export async function terminateWindowsProcessTree(
  pid: number,
  options: ProcessTreeTerminationOptions,
): Promise<boolean> {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (!options.isAlive(pid)) return true;

  const spawnTreeKiller = options.spawnTreeKiller ?? ((targetPid: number) => (
    spawn('taskkill', ['/pid', String(targetPid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    })
  ));
  try {
    const killer = spawnTreeKiller(pid);
    // Consume both terminal events; liveness below is the source of truth.
    killer.once('error', () => undefined);
    killer.once('exit', () => undefined);
  } catch {
    // A concurrent exit can still make the operation successful.
  }

  const timeoutMs = Math.max(0, options.timeoutMs ?? 5_000);
  const pollIntervalMs = Math.max(1, options.pollIntervalMs ?? 50);
  const deadline = Date.now() + timeoutMs;
  while (options.isAlive(pid) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return !options.isAlive(pid);
}
