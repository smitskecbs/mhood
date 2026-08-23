export const INTRO_HOLD_MS = 2400;
export const CROSSFADE_MS = 2800;
export const ACCESS_GRANTED_MS = 2200;
export const FOREST_FADE_MS = 2200;
export const BALANCE_REFRESH_MS = 45_000;

export const MHOOD_DECIMALS = 6;
export const MHOOD_ORIGINAL_SUPPLY_UI = 1_000_000_000n;
export const MHOOD_ORIGINAL_SUPPLY_RAW = MHOOD_ORIGINAL_SUPPLY_UI * 10n ** BigInt(MHOOD_DECIMALS);

export const BACKGROUNDS = {
  gateI: '/backgrounds/background1.jpg',
  gateII: '/backgrounds/background2.jpg',
  forest: '/backgrounds/background3.jpg',
} as const;

export const COPY = {
  gateLine: 'THE FOREST DOES NOT OPEN FOR EVERYONE.',
  proveClaim: 'PROVE YOUR CLAIM',
  proveClaimSub: 'Sign a message to prove this wallet belongs to you.',
  signToEnter: 'Sign to enter',
  forestClosed: 'The forest remains closed.',
  tryAgain: 'Try again',
  cannotSign: 'This wallet cannot sign the Forest access message.',
  insufficient: 'THE FOREST REMAINS CLOSED',
  insufficientSub: 'You do not hold enough MHOOD to enter the forest.',
  tryAnotherWallet: 'Try another wallet',
  disconnectWallet: 'Disconnect',
  granted: 'ACCESS GRANTED',
  forestCloses: 'THE FOREST CLOSES.',
  rpcUnavailable: 'The forest cannot verify your MHOOD right now.',
  rpcUnavailableDetail: 'RPC connection unavailable.',
  holderVerifyFailed: 'The forest could not verify this wallet.',
  ledgerReading: 'Reading the forest ledger...',
  ledgerError: 'The forest ledger cannot be read right now.',
  noBurns: 'No verified forest burns yet.',
  legendsPersistenceInactive:
    'Persistent production burn history is not active yet. On-chain burns can still complete; Forest Legends will list them once a ledger is configured.',
  legendsIndexedIncomplete:
    'Forest Legends shows verified indexed burns. Global Total Burned comes from on-chain supply.',
  yourPosition: 'Your position',
  burnTitle: 'THE BURNING GROVE',
  burnPrompt: 'Choose what you are willing to return to the forest.',
  burnConfirmTitle: 'RETURN TO THE FOREST',
  burnIrreversible: 'This action cannot be reversed.',
  confirmBurn: 'Confirm burn',
  verifiedBurn: 'VERIFIED BURN',
  burnSuccessTitle: 'RETURNED TO THE FOREST',
  offeringWithdrawn: 'The offering was withdrawn.',
  burnUnconfirmed: 'The forest could not confirm the burn.',
  burnConfirmTimeout: 'The burn was sent but confirmation timed out.',
  burnCouldNotComplete: 'The burn could not be completed.',
  burnVerifiedPersistenceInactive:
    'Burn verified on-chain. Leaderboard storage is not yet persistent.',
  distributionTitle: 'TOKEN DISTRIBUTION',
  holdersTitle: 'FOREST HOLDERS',
  legendsTitle: 'FOREST LEGENDS',
} as const;
