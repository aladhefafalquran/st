import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHistory } from '@/api/watchlist';
import { imgUrl } from '@/api/tmdb';
import { Spinner } from '@/components/ui/Spinner';
import { WatchHistoryItem } from '@streamtime/shared';
import { useAuthStore } from '@/store/authStore';

function formatProgress(progress: number, duration: number): string {
  if (!duration) return '';
  const pct = Math.round((progress / duration) * 100);
  return `${pct}%`;
}

export function History() {
  const { isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getHistory()
      .then(({ items }) => setItems(items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="pt-20 px-8 text-center">
        <p className="text-[var(--st-text-muted)] mb-4">Sign in to view your watch history.</p>
        <Link to="/login" className="text-[var(--st-accent)] hover:underline">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      <h1 className="text-3xl font-bold text-white mb-8">Watch History</h1>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <p className="text-[var(--st-text-muted)]">No watch history yet. Start watching something!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => {
            const progress = formatProgress(item.progressSeconds, item.durationSeconds);
            return (
              <Link
                key={item.id}
                to={`/${item.mediaType}/${item.tmdbId}`}
                className="group cursor-pointer"
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
                  {/* Progress bar */}
                  {item.durationSeconds > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-[var(--st-accent)]"
                        style={{ width: `${Math.min(100, (item.progressSeconds / item.durationSeconds) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-[var(--st-text)] truncate">{item.title}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--st-text-muted)]">
                    {item.seasonNumber ? `S${item.seasonNumber}E${item.episodeNumber}` : item.mediaType}
                  </p>
                  {progress && <p className="text-xs text-[var(--st-accent)]">{progress}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
