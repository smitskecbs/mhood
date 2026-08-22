/**
 * Token amount helpers that stay on bigint / decimal strings.
 * Never convert large raw amounts through JavaScript number for comparisons.
 */

export function uiAmountToRaw(uiAmount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`Unsupported decimals: ${decimals}`);
  }

  const cleaned = uiAmount.replace(/,/g, '').trim();
  if (!cleaned) {
    throw new Error('Amount is empty');
  }
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error('Amount must be a positive decimal number');
  }

  const [wholePart, fractionPart = ''] = cleaned.split('.');
  if (fractionPart.length > decimals) {
    throw new Error('Too many decimal places for this mint');
  }

  const fractionPadded = fractionPart.padEnd(decimals, '0');
  const combined = `${wholePart}${fractionPadded}`.replace(/^0+(?=\d)/, '');
  return BigInt(combined || '0');
}

export function rawAmountToUiString(raw: bigint, decimals: number): string {
  if (raw < 0n) {
    throw new Error('Negative token amounts are not supported');
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Unsupported decimals: ${decimals}`);
  }
  if (decimals === 0) {
    return raw.toString();
  }

  const padded = raw.toString().padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export function formatTokenAmount(raw: bigint, decimals: number): string {
  const ui = rawAmountToUiString(raw, decimals);
  const [whole, fraction] = ui.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function parseUiInputToRaw(input: string, decimals: number): bigint {
  return uiAmountToRaw(input, decimals);
}

/**
 * User-entered burn amount. Bigint only. Optional MHOOD suffix is stripped.
 */
export function parseBurnAmountInput(input: string, decimals: number, maxRaw?: bigint): bigint {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Amount is empty');
  }
  if (/^-/.test(trimmed.replace(/,/g, ''))) {
    throw new Error('Burn amount cannot be negative');
  }
  const withoutSymbol = trimmed.replace(/,/g, '').replace(/\s*MHOOD\s*$/i, '').trim();
  if (!withoutSymbol) {
    throw new Error('Amount is empty');
  }
  if (!/^\d+(\.\d+)?$/.test(withoutSymbol)) {
    throw new Error('Amount must be a positive decimal number');
  }
  const raw = uiAmountToRaw(withoutSymbol, decimals);
  if (raw <= 0n) {
    throw new Error('Burn amount must be greater than zero');
  }
  if (maxRaw !== undefined && raw > maxRaw) {
    throw new Error('Burn amount exceeds wallet MHOOD balance');
  }
  return raw;
}

export function meetsThreshold(balanceRaw: bigint, thresholdRaw: bigint): boolean {
  return balanceRaw >= thresholdRaw;
}

export function compareRawDesc(a: bigint, b: bigint): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

export function percentOf(raw: bigint, percent: number): bigint {
  if (percent < 0 || percent > 100) {
    throw new Error('Percent must be between 0 and 100');
  }
  return (raw * BigInt(percent)) / 100n;
}
