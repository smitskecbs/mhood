/**
 * DEVELOPMENT / LOCAL UI DATA ONLY.
 *
 * These wallets and amounts are not live on-chain holder snapshots.
 * They exist so ranking UI, sorting, and service wiring can be built
 * before an indexer/backend is connected.
 *
 * Replace the provider — do not scatter extra hardcoded rows through components.
 */

export const MOCK_DATA_DISCLAIMER =
  'Development ranking data — not a live on-chain snapshot.';

export const MOCK_HOLDER_WALLETS = [
  { wallet: 'MOCK_FOREST_HOLDER_01_NOT_LIVE', ui: '25000000' },
  { wallet: 'MOCK_FOREST_HOLDER_02_NOT_LIVE', ui: '18400000' },
  { wallet: 'MOCK_FOREST_HOLDER_03_NOT_LIVE', ui: '12150000' },
  { wallet: 'MOCK_FOREST_HOLDER_04_NOT_LIVE', ui: '8900000' },
  { wallet: 'MOCK_FOREST_HOLDER_05_NOT_LIVE', ui: '6400000' },
  { wallet: 'MOCK_FOREST_HOLDER_06_NOT_LIVE', ui: '4820000' },
  { wallet: 'MOCK_FOREST_HOLDER_07_NOT_LIVE', ui: '3100000' },
  { wallet: 'MOCK_FOREST_HOLDER_08_NOT_LIVE', ui: '1750000' },
  { wallet: 'MOCK_FOREST_HOLDER_09_NOT_LIVE', ui: '1250000' },
  { wallet: 'MOCK_FOREST_HOLDER_10_NOT_LIVE', ui: '1000000' },
  { wallet: 'MOCK_FOREST_HOLDER_11_NOT_LIVE', ui: '742381' },
] as const;

export const MOCK_BURN_RECORDS = [
  {
    signature: 'SIM_NOT_ONCHAIN_BURN_SIG_01',
    wallet: 'MOCK_FOREST_BURNER_01_NOT_LIVE',
    amountUi: '4200000',
    timestamp: 1_720_000_000,
    slot: 1,
  },
  {
    signature: 'SIM_NOT_ONCHAIN_BURN_SIG_02',
    wallet: 'MOCK_FOREST_BURNER_01_NOT_LIVE',
    amountUi: '1800000',
    timestamp: 1_720_100_000,
    slot: 2,
  },
  {
    signature: 'SIM_NOT_ONCHAIN_BURN_SIG_03',
    wallet: 'MOCK_FOREST_BURNER_02_NOT_LIVE',
    amountUi: '3500000',
    timestamp: 1_720_200_000,
    slot: 3,
  },
  {
    signature: 'SIM_NOT_ONCHAIN_BURN_SIG_04',
    wallet: 'MOCK_FOREST_BURNER_03_NOT_LIVE',
    amountUi: '2100000',
    timestamp: 1_720_300_000,
    slot: 4,
  },
  {
    signature: 'SIM_NOT_ONCHAIN_BURN_SIG_05',
    wallet: 'MOCK_FOREST_BURNER_02_NOT_LIVE',
    amountUi: '900000',
    timestamp: 1_720_400_000,
    slot: 5,
  },
  {
    signature: 'SIM_NOT_ONCHAIN_BURN_SIG_06',
    wallet: 'MOCK_FOREST_BURNER_04_NOT_LIVE',
    amountUi: '1250000',
    timestamp: 1_720_500_000,
    slot: 6,
  },
] as const;
