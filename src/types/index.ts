export const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export type TokenProgramKind = 'spl-token' | 'token-2022';

export type MintDetails = {
  mint: string;
  decimals: number;
  supplyRaw: bigint;
  tokenProgramId: string;
  tokenProgramKind: TokenProgramKind;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  space: number;
};

export type TokenAccountBalance = {
  address: string;
  amountRaw: bigint;
  owner?: string;
  mint?: string;
  state?: 'initialized' | 'frozen' | string;
  spendable?: boolean;
};

export type WalletMhoodBalance = {
  wallet: string;
  mint: string;
  decimals: number;
  tokenProgramKind: TokenProgramKind;
  totalRaw: bigint;
  accounts: TokenAccountBalance[];
  meetsAccessThreshold: boolean;
  fetchedAt: number;
};

export type HolderRankingEntry = {
  rank: number;
  wallet: string;
  balanceRaw: string;
  balanceUi: string;
  supplyPercent: string;
  tier?: HolderTier;
};

export type HolderTier = 'wanderer' | 'keeper' | 'elder' | 'legend';

export type RankingSourceKind = 'mock' | 'indexer' | 'rpc' | 'none' | 'local';

export type BurnPersistenceMode = 'local' | 'inactive' | 'persistent';

export type HolderRankingSnapshot = {
  entries: HolderRankingEntry[];
  source: RankingSourceKind;
  live: boolean;
  disclaimer: string;
  fetchedAt: number;
};

export type BurnRecord = {
  signature: string;
  wallet: string;
  mint: string;
  amountRaw: string;
  amountUi: string;
  slot: number;
  timestamp: number | null;
  /** Simulated records must never be presented as on-chain burns. */
  simulated?: boolean;
};

export type BurnRankingEntry = {
  rank: number;
  wallet: string;
  totalBurnedRaw: string;
  totalBurnedUi: string;
  burns: number;
  lastBurn: number | null;
  label?: string;
};

export type BurnRankingSnapshot = {
  entries: BurnRankingEntry[];
  records: BurnRecord[];
  totalBurnedRaw: string;
  totalBurns: number;
  uniqueBurners: number;
  source: RankingSourceKind;
  live: boolean;
  disclaimer: string;
  fetchedAt: number;
  persistence?: BurnPersistenceMode;
};

export type AccessStatus =
  | 'disconnected'
  | 'awaiting_signature'
  | 'checking'
  | 'insufficient'
  | 'granted'
  | 'error';

export type ForestScene =
  | 'intro'
  | 'gateDwell'
  | 'gate'
  | 'denied'
  | 'granted'
  | 'forestEntry'
  | 'forestDwell'
  | 'forest';

export type BurnMode = 'simulation' | 'real';

export type PreparedBurn = {
  mode: BurnMode;
  wallet: string;
  mint: string;
  tokenProgramId: string;
  tokenProgramKind: TokenProgramKind;
  decimals: number;
  amountRaw: bigint;
  amountUi: string;
  allocations: Array<{ tokenAccount: string; amountRaw: bigint }>;
  instructionCount: number;
};

export type BurnErrorCategory =
  | 'wallet-rejected'
  | 'rpc-unavailable'
  | 'transaction-failed'
  | 'verification-failed'
  | 'persistence-failed'
  | 'unknown';

export type BurnExecutionResult =
  | {
      mode: 'simulation';
      prepared: PreparedBurn;
      message: string;
    }
  | {
      mode: 'real';
      prepared: PreparedBurn;
      signature: string;
      verified: true;
      slot: number;
      timestamp: number | null;
      persistence?: BurnPersistenceMode;
    };
