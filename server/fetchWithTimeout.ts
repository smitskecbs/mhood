export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

export async function fetchJsonWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  if (init.signal?.aborted) {
    throw new Error(timeoutMessage);
  }
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  init.signal?.addEventListener('abort', onOuterAbort);

  let rejectTimeout: ((err: Error) => void) | undefined;
  const timer = setTimeout(() => {
    controller.abort();
    rejectTimeout?.(new Error(timeoutMessage));
  }, timeoutMs);
  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });

  const work = (async () => {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
  })();
  void work.catch(() => undefined);

  try {
    return await Promise.race([work, timeoutPromise]);
  } catch (err) {
    if (isAbortError(err) || (err instanceof Error && err.message === timeoutMessage)) {
      throw new Error(timeoutMessage);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onOuterAbort);
  }
}
