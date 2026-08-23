import { describe, expect, it } from 'vitest';
import { formatDeniedBalance, formatDeniedRequired } from './deniedCopy';

describe('denied copy', () => {
  it('formats the required threshold and the wallet balance', () => {
    expect(formatDeniedRequired('1,000,000')).toBe('Required: 1,000,000 MHOOD');
    expect(formatDeniedBalance('742,381')).toBe('Your balance: 742,381 MHOOD');
  });
});
