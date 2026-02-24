import { useState, useEffect, useCallback } from 'react';
import {
  addToWatchlist as apiAdd,
  removeFromWatchlist as apiRemove,
  checkWatchlist as apiCheck,
} from '@/api/watchlist';
import { useAuthStore } from '@/store/authStore';

export function useWatchlist(tmdbId: number, mediaType: 'movie' | 'tv') {
  const { isAuthenticated } = useAuthStore();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !tmdbId) return;
    apiCheck(tmdbId, mediaType)
      .then(({ inWatchlist }) => setInWatchlist(inWatchlist))
      .catch(() => {});
  }, [isAuthenticated, tmdbId, mediaType]);

  const toggle = useCallback(
    async (title: string, posterPath?: string | null) => {
      if (!isAuthenticated) return;
      setLoading(true);
      try {
        if (inWatchlist) {
          await apiRemove(tmdbId, mediaType);
          setInWatchlist(false);
        } else {
          await apiAdd({ tmdbId, mediaType, title, posterPath });
          setInWatchlist(true);
        }
      } catch {
        // keep previous state on error
      } finally {
        setLoading(false);
      }
    },
    [inWatchlist, isAuthenticated, tmdbId, mediaType],
  );

  return { inWatchlist, loading, toggle };
}
