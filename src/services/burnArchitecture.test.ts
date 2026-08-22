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

  it('keeps server burn backfill on HTTP JSON-RPC without web3 Connection', () => {
    const admin = readFileSync(path.resolve(process.cwd(), 'api/admin/backfill-burns.ts'), 'utf8');
    const verify = readFileSync(path.resolve(process.cwd(), 'server/verifyOnChainBurn.ts'), 'utf8');
    const core = readFileSync(path.resolve(process.cwd(), 'src/services/burnVerificationCore.ts'), 'utf8');
    expect(admin).not.toMatch(/@solana\/web3\.js|rpc-websockets|verifiedBurnsApi/);
    expect(verify).toMatch(/heliusRpc/);
    expect(verify).toMatch(/burnVerificationCore/);
    expect(verify).not.toMatch(/from ['"]@solana\/web3\.js['"]|rpc-websockets|new Connection/);
    expect(core).not.toMatch(/from ['"]@solana\/web3\.js['"]|from ['"]@solana\/spl-token['"]|rpc-websockets/);
  });
});
