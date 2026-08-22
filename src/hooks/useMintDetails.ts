import { useCallback, useEffect, useState } from 'react';
import type { MintDetails } from '../types';
import { fetchMintDetails } from '../services/solana/mintService';

export function useMintDetails() {
  const [mint, setMint] = useState<MintDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const details = await fetchMintDetails();
      setMint(details);
      setError(null);
      return details;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read mint account';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { mint, error, loading, refresh };
}
