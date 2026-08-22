export function backfillSecretFromEnv(env: NodeJS.Dict<string> = process.env): string {
  return (env.BURN_BACKFILL_SECRET || '').trim();
}

export function authorizeBackfillRequest(
  request: { headers?: Headers | Record<string, string | string[] | undefined> },
  secret = backfillSecretFromEnv(),
): boolean {
  if (!secret) return false;
  const headers = request.headers;
  let authorization = '';
  if (headers && typeof (headers as Headers).get === 'function') {
    authorization = (headers as Headers).get('authorization') ?? '';
  } else if (headers && typeof headers === 'object') {
    const raw =
      (headers as Record<string, string | string[] | undefined>).authorization ??
      (headers as Record<string, string | string[] | undefined>).Authorization;
    authorization = Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
  }
  const expected = `Bearer ${secret}`;
  return authorization === expected;
}
