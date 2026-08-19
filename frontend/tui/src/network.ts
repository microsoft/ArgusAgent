export const DEFAULT_META_TIMEOUT_MS = 8_000;
export const DEFAULT_READ_TIMEOUT_MS = 12_000;

type FetchFailure = Error & {
  cause?: unknown;
  code?: unknown;
  address?: unknown;
  port?: unknown;
};

function requestUrl(input: string | URL | Request): string {
  const raw = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
  try {
    const url = new URL(raw);
    url.username = '';
    url.password = '';
    if (url.searchParams.has('token')) url.searchParams.set('token', '[redacted]');
    return url.toString();
  } catch {
    return raw;
  }
}

function errorField(error: unknown, field: keyof FetchFailure): unknown {
  return typeof error === 'object' && error !== null
    ? (error as FetchFailure)[field]
    : undefined;
}

function failureCause(error: unknown): unknown {
  let current = errorField(error, 'cause');
  const seen = new Set<unknown>();
  while (errorField(current, 'cause') && !seen.has(current)) {
    seen.add(current);
    current = errorField(current, 'cause');
  }
  return current ?? error;
}

/** Preserve the useful Node/Undici error hidden behind TypeError("fetch failed"). */
export function describeFetchFailure(
  error: unknown,
  input: string | URL | Request,
  method = 'GET',
): string {
  const cause = failureCause(error);
  const code = String(errorField(cause, 'code') ?? '').trim();
  const address = String(errorField(cause, 'address') ?? '').trim();
  const port = String(errorField(cause, 'port') ?? '').trim();
  const endpoint = address && port ? `${address}:${port}` : address;
  const causeMessage = cause instanceof Error ? cause.message.trim() : String(cause ?? '').trim();
  const outerMessage = error instanceof Error ? error.message.trim() : String(error ?? '').trim();

  let detail: string;
  if (code === 'ECONNREFUSED') detail = `connection refused${endpoint ? ` by ${endpoint}` : ''}`;
  else if (code === 'ECONNRESET') detail = 'connection reset by the local service';
  else if (code === 'ETIMEDOUT') detail = 'connection timed out';
  else if (code === 'ENOTFOUND') detail = 'host name could not be resolved';
  else if (causeMessage && causeMessage !== outerMessage) detail = causeMessage;
  else detail = outerMessage || 'network request failed';

  return `${method.toUpperCase()} ${requestUrl(input)} failed: ${detail}${code ? ` (${code})` : ''}`;
}

function durationLabel(timeoutMs: number): string {
  return timeoutMs % 1_000 === 0 ? `${timeoutMs / 1_000}s` : `${timeoutMs}ms`;
}

async function timedRequest<T>(
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
  method: string,
  consume: (response: Response) => Promise<T> | T,
): Promise<T> {
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.max(1, Math.trunc(timeoutMs))
    : 1;
  const controller = new AbortController();
  const parentSignal = init.signal;
  let didTimeout = false;
  let responseReceived = false;
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) onParentAbort();
  else parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  const operation = (async () => {
    const response = await fetch(input, { ...init, signal: controller.signal });
    responseReceived = true;
    return await consume(response);
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      didTimeout = true;
      const timeoutError = new Error(`request timed out after ${durationLabel(timeout)}`);
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeout);
  });

  try {
    return await Promise.race([operation, deadline]);
  } catch (error) {
    if (didTimeout) {
      throw new Error(
        `${method.toUpperCase()} ${requestUrl(input)} timed out after ${durationLabel(timeout)}; `
        + 'the local Argus service did not respond',
        { cause: error },
      );
    }
    if (parentSignal?.aborted) {
      if (parentSignal.reason instanceof Error) throw parentSignal.reason;
      throw new Error(`${method.toUpperCase()} ${requestUrl(input)} was aborted`, { cause: error });
    }
    if (responseReceived && errorField(error, 'cause') === undefined) throw error;
    throw new Error(describeFetchFailure(error, input, method), { cause: error });
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

/** Bound connection establishment for callers that consume the response later. */
export function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs: number,
  method = init.method ?? 'GET',
): Promise<Response> {
  return timedRequest(input, init, timeoutMs, method, (response) => response);
}

/** Bound the complete request, including a streaming response body consumer. */
export function requestWithTimeout<T>(
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
  consume: (response: Response) => Promise<T> | T,
  method = init.method ?? 'GET',
): Promise<T> {
  return timedRequest(input, init, timeoutMs, method, consume);
}
