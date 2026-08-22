import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('real burn architecture', () => {
  it('keeps signing on the wallet client and does not persist a fake production ledger', () => {
    const burnService = readFileSync(path.resolve(process.cwd(), 'src/services/burnService.ts'), 'utf8');
    const vercelBurns = readFileSync(path.resolve(process.cwd(), 'api/verified-burns.ts'), 'utf8');
    expect(burnService).toMatch(/sendTransaction/);
    expect(burnService).not.toMatch(/Keypair\.fromSecretKey/);
    expect(burnService).not.toMatch(/HELIUS_RPC_URL/);
    expect(vercelBurns).toMatch(/createVerifiedBurnStore/);
    expect(vercelBurns).not.toMatch(/writeFileSync/);
    expect(vercelBurns).not.toMatch(/fromSecretKey/);
  });

  it('confirms production burns with HTTP polling and no WebSocket subscriptions', () => {
    const burnService = readFileSync(path.resolve(process.cwd(), 'src/services/burnService.ts'), 'utf8');
    expect(burnService).toMatch(/getSignatureStatuses/);
    expect(burnService).toMatch(/confirming burn via HTTP polling/);
    expect(burnService).not.toMatch(/connection\.confirmTransaction/);
    expect(burnService).not.toMatch(/onSignature\(/);
    expect(burnService).not.toMatch(/onAccountChange\(/);
  });
});
