import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MediaCard } from '@/components/media/MediaCard';
import { Spinner } from '@/components/ui/Spinner';
import { searchMulti } from '@/api/tmdb';
import { TMDBMultiResult } from '@streamtime/shared';

export function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [results, setResults] = useState<TMDBMultiResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    setLoading(true);
    searchMulti(query)
      .then((res) => {
        setResults(
          res.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv'),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      <h1 className="text-2xl font-bold text-white mb-6">
        {query ? `Results for "${query}"` : 'Search'}
      </h1>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : results.length === 0 ? (
        <p className="text-[var(--st-text-muted)]">
          {query ? 'No results found.' : 'Enter a search term above.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((item) => (
            <MediaCard key={`${item.id}-${item.media_type}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
