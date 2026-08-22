/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC_URL: string;
  readonly VITE_MHOOD_MINT: string;
  readonly VITE_MHOOD_ACCESS_THRESHOLD: string;
  readonly VITE_ENABLE_REAL_BURN: string;
  readonly VITE_DEV_BYPASS_GATE?: string;
  readonly VITE_SHOW_GATE_DEBUG?: string;
  readonly VITE_RANKING_SOURCE?: string;
  readonly VITE_HOLDER_INDEXER_URL?: string;
  readonly VITE_BURN_INDEXER_URL?: string;
  readonly VITE_EXPLORER_TX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
