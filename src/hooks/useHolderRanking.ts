import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HolderRankingSnapshot, MintDetails } from '../types';
import { COPY } from '../config/constants';
import { createHolderRankingService } from '../services/holderRankingService';
import { devLog, formatRpcError } from '../utils/devLog';

const service = createHolderRankingService();

export function useHolderRanking(mint: MintDetails | null, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<HolderRankingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (options?: { bypassCache?: boolean }) => {
      if (!mint || !enabled) return;
      setLoading(true);
      try {
        const next = await service.getRanking(mint, { bypassCache: options?.bypassCache });
        setSnapshot(next);
        setError(null);
      } catch (err) {
        setSnapshot(null);
        setError(COPY.ledgerError);
        devLog('holder ranking error', { error: formatRpcError(err) });
      } finally {
        setLoading(false);
      }
    },
    [mint, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return useMemo(
    () => ({ snapshot, error, loading, refresh, live: snapshot?.live ?? false }),
    [snapshot, error, loading, refresh],
  );
}
