import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  formatGateDelta,
  logWalletUiReady,
  markGateIIStart,
  markInteractionClick,
  msSinceClick,
  msSinceGateII,
} from './gateTiming';

describe('gate interaction timing logs', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports wallet UI visible and interactive at the same Gate II offset', () => {
    markGateIIStart(1_000);
    expect(msSinceGateII(11_000)).toBe(10_000);
    expect(formatGateDelta(10_000)).toBe('+10000ms');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    logWalletUiReady();
    const messages = info.mock.calls.map((call) => String(call[0]));
    expect(messages.some((line) => line.includes('wallet UI visible'))).toBe(true);
    expect(messages.some((line) => line.includes('wallet UI interactive'))).toBe(true);
    info.mockRestore();
  });

  it('measures Open the gate → picker as the click delta', () => {
    markInteractionClick(40);
    expect(msSinceClick(40)).toBe(0);
    expect(msSinceClick(48)).toBe(8);
  });
});
