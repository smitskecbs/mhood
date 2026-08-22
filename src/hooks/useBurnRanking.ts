import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BurnRankingSnapshot, MintDetails } from '../types';
import { createBurnRankingService } from '../services/burnRankingService';

const service = createBurnRankingService();

export function useBurnRanking(mint: MintDetails | null) {
  const [snapshot, setSnapshot] = useState<BurnRankingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!mint) return;
    setLoading(true);
    try {
      const next = await service.getRanking(mint.decimals);
      setSnapshot(next);
      setError(null);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : 'Burn ranking failed');
    } finally {
      setLoading(false);
    }
  }, [mint]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ snapshot, error, loading, refresh, live: snapshot?.live ?? false }),
    [snapshot, error, loading, refresh],
  );
}
