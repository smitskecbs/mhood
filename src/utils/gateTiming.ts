export function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

let gateIIStartedAt = 0;
let lastClickAt = 0;

export function markGateIIStart(at = nowMs()): void {
  gateIIStartedAt = at;
}

export function markInteractionClick(at = nowMs()): void {
  lastClickAt = at;
}

export function msSinceGateII(at = nowMs()): number {
  if (!gateIIStartedAt) return 0;
  return Math.max(0, Math.round(at - gateIIStartedAt));
}

export function msSinceClick(at = nowMs()): number {
  if (!lastClickAt) return 0;
  return Math.max(0, Math.round(at - lastClickAt));
}

export function formatGateDelta(ms: number): string {
  return `+${ms}ms`;
}

export function logGateTiming(message: string, extra?: string): void {
  if (!import.meta.env.DEV) return;
  const suffix = extra ? `: ${extra}` : '';
  console.info(`[MoginHood] ${message}${suffix}`);
}

export function logWalletUiReady(): void {
  const delta = formatGateDelta(msSinceGateII());
  logGateTiming('wallet UI visible', delta);
  logGateTiming('wallet UI interactive', delta);
}
