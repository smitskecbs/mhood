import type { TokenAccountBalance } from '../types';

export function isSpendableTokenAccount(account: TokenAccountBalance): boolean {
  if (account.amountRaw <= 0n) return false;
  if (account.state === 'frozen') return false;
  if (account.spendable === false) return false;
  return true;
}

export function spendableTokenAccounts(accounts: TokenAccountBalance[]): TokenAccountBalance[] {
  return accounts.filter(isSpendableTokenAccount);
}

export function sumTokenAccounts(accounts: TokenAccountBalance[]): bigint {
  return accounts.reduce((total, account) => total + account.amountRaw, 0n);
}

/**
 * Split a burn amount across token accounts without overdrawing any account.
 * If one account can cover the burn, use the smallest such account.
 * Otherwise take only what is needed from accounts in the given order.
 */
export function allocateBurnAcrossAccounts(
  accounts: TokenAccountBalance[],
  amountRaw: bigint,
): Array<{ tokenAccount: string; amountRaw: bigint }> {
  if (amountRaw <= 0n) {
    throw new Error('Burn amount must be greater than zero');
  }

  const usable = spendableTokenAccounts(accounts);
  const available = sumTokenAccounts(usable);
  if (available < amountRaw) {
    throw new Error('Insufficient MHOOD balance for this burn');
  }

  const covering = [...usable]
    .filter((account) => account.amountRaw >= amountRaw)
    .sort((a, b) => (a.amountRaw === b.amountRaw ? 0 : a.amountRaw < b.amountRaw ? -1 : 1));
  if (covering[0]) {
    return [{ tokenAccount: covering[0].address, amountRaw }];
  }

  const allocations: Array<{ tokenAccount: string; amountRaw: bigint }> = [];
  let remaining = amountRaw;

  for (const account of usable) {
    if (remaining === 0n) break;
    const take = account.amountRaw < remaining ? account.amountRaw : remaining;
    if (take > 0n) {
      allocations.push({ tokenAccount: account.address, amountRaw: take });
      remaining -= take;
    }
  }

  if (remaining !== 0n) {
    throw new Error('Could not allocate burn across token accounts');
  }

  return allocations;
}
