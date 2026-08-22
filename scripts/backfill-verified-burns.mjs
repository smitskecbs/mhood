#!/usr/bin/env node
/**
 * One-time verified-burn backfill.
 *
 * Production:
 *   BURN_BACKFILL_SECRET=... BACKFILL_URL=https://mhood.cbs-coin.com npm run backfill:burns
 *
 * Local (Vite dev server running):
 *   BURN_BACKFILL_SECRET=... BACKFILL_URL=http://localhost:5173 npm run backfill:burns
 */
const secret = (process.env.BURN_BACKFILL_SECRET || '').trim();
const base = (process.env.BACKFILL_URL || 'https://mhood.cbs-coin.com').replace(/\/$/, '');

if (!secret) {
  console.error('Set BURN_BACKFILL_SECRET before running the backfill.');
  process.exit(1);
}

const response = await fetch(`${base}/api/admin/backfill-burns`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}` },
});
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`Backfill failed (${response.status})`, payload);
  process.exit(1);
}
console.log(JSON.stringify(payload, null, 2));
