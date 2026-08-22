export const PROJECT_WALLETS = {
  treasury: {
    address: 'ARVwsynREWHLbLy4KG4PkXeK9Ad27uGCzp7FFhcbdStQ',
    label: 'Treasury',
  },
  tokenLock: {
    address: '9cmYh7CSj8izAiPSbuNFo9U5eiNnXF7DCEidM73P5FPS',
    label: '15% Token Lock',
  },
  dev: {
    address: 'HaQD1dv7Y4EGCvptiqcMWXmAazjLBekzAsoKw6ejBszT',
    label: 'Dev Wallet',
  },
  /**
   * Live Helius ranking on 2026-08-22 placed this wallet at on-chain #4.
   * The address is fixed; the rank is not. Do not key off rank === 4.
   */
  presale: {
    address: 'FwrAHTKGRptE6JKw53Cagcz5i45FeRq6fCfUAKmyrZhb',
    label: 'Presale Site',
  },
} as const;

export type ProjectWalletId = keyof typeof PROJECT_WALLETS;

export type ProjectWallet = (typeof PROJECT_WALLETS)[ProjectWalletId];

export const PROJECT_WALLET_ORDER: ProjectWalletId[] = ['treasury', 'tokenLock', 'dev', 'presale'];

export function projectWalletList(): Array<ProjectWallet & { id: ProjectWalletId }> {
  return PROJECT_WALLET_ORDER.map((id) => ({ id, ...PROJECT_WALLETS[id] }));
}

export function projectWalletAddressSet(): Set<string> {
  return new Set(projectWalletList().map((wallet) => wallet.address));
}

export function isProjectWallet(address: string): boolean {
  return projectWalletAddressSet().has(address);
}

export function findProjectWallet(address: string): (ProjectWallet & { id: ProjectWalletId }) | null {
  return projectWalletList().find((wallet) => wallet.address === address) ?? null;
}
