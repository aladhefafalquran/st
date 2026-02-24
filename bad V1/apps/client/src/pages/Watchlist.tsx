import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWatchlist } from '@/api/watchlist';
import { imgUrl } from '@/api/tmdb';
import { Spinner } from '@/components/ui/Spinner';
import { WatchlistItem } from '@streamtime/shared';
import { useAuthStore } from '@/store/authStore';

export function Watchlist() {
  const { isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getWatchlist()
      .then(({ items }) => setItems(items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="pt-20 px-8 text-center">
        <p className="text-[var(--st-text-muted)] mb-4">Sign in to view your watchlist.</p>
        <Link to="/login" className="text-[var(--st-accent)] hover:underline">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      <h1 className="text-3xl font-bold text-white mb-8">My Watchlist</h1>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <p className="text-[var(--st-text-muted)]">Your watchlist is empty. Add movies and TV shows to get started.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/${item.mediaType}/${item.tmdbId}`}
              className="group flex-shrink-0 cursor-pointer"
            >
              <div className="relative overflow-hidden rounded-lg bg-[var(--st-surface-2)] aspect-[2/3]">
                {item.posterPath ? (
                  <img
                    src={imgUrl(item.posterPath, 'w342') ?? ''}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--st-text-muted)] text-xs text-center p-2">
                    {item.title}
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--st-text)] truncate">{item.title}</p>
              <p className="text-xs text-[var(--st-text-muted)] capitalize">{item.mediaType}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
