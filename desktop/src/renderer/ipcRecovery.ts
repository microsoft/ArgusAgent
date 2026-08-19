export type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; detail: string };

export function ipcErrorDetail(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** Convert a rejected Electron IPC call into explicit renderer state. */
export async function captureIpc<T>(operation: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, detail: ipcErrorDetail(error) };
  }
}
