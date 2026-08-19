export interface ConsoleTransportLike {
  level: string | false;
  writeFn(payload: unknown): void;
}

export interface StreamErrorEmitter {
  on(event: 'error', listener: (error: unknown) => void): unknown;
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code.toUpperCase() : undefined;
}

export function isBrokenPipeError(error: unknown): boolean {
  return errorCode(error) === 'EPIPE';
}

/**
 * Stop a closed parent terminal from turning console logging into an EPIPE
 * recursion.  The handler deliberately never logs: its output channel is the
 * component that just failed, while the file transport remains available.
 */
export function installConsolePipeGuard(
  transport: ConsoleTransportLike,
  streams: readonly StreamErrorEmitter[] = [process.stdout, process.stderr]
): void {
  let disabled = transport.level === false;
  const disable = (): void => {
    disabled = true;
    transport.level = false;
  };

  const originalWrite = transport.writeFn;
  transport.writeFn = function guardedConsoleWrite(payload: unknown): void {
    if (disabled) return;
    try {
      originalWrite.call(transport, payload);
    } catch (error) {
      if (!isBrokenPipeError(error)) throw error;
      disable();
    }
  };

  for (const stream of streams) {
    stream.on('error', () => disable());
  }
}
