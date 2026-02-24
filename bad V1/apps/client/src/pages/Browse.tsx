import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MediaCard } from '@/components/media/MediaCard';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { getPopularMovies, getPopularTV, getTopRatedMovies } from '@/api/tmdb';
import { TMDBMultiResult, TMDBMovie, TMDBTVShow } from '@streamtime/shared';

function toMulti(items: TMDBMovie[] | TMDBTVShow[], mediaType: 'movie' | 'tv'): TMDBMultiResult[] {
  return items.map((item) => ({
    ...item,
    media_type: mediaType,
    title: 'title' in item ? item.title : undefined,
    name: 'name' in item ? item.name : undefined,
    release_date: 'release_date' in item ? item.release_date : undefined,
    first_air_date: 'first_air_date' in item ? item.first_air_date : undefined,
  }));
}

export function Browse() {
  const { type } = useParams<{ type: 'movies' | 'tv' }>();
  const [items, setItems] = useState<TMDBMultiResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const mediaType = type === 'tv' ? 'tv' : 'movie';

  useEffect(() => {
    setItems([]);
    setPage(1);
    setLoading(true);
  }, [type]);

  useEffect(() => {
    const fetcher = mediaType === 'tv' ? getPopularTV : getPopularMovies;
    const setter = page === 1 ? setLoading : setLoadingMore;
    setter(true);

    fetcher(page)
      .then((res) => {
        const converted = toMulti(res.results as unknown as TMDBMovie[], mediaType);
        setItems((prev) => (page === 1 ? converted : [...prev, ...converted]));
        setTotalPages(res.total_pages);
      })
      .catch(console.error)
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [type, page, mediaType]);

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      <h1 className="text-3xl font-bold text-white mb-8">
        {type === 'tv' ? 'TV Shows' : 'Movies'}
      </h1>

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => (
              <MediaCard key={`${item.id}-${item.media_type}`} item={item} mediaType={mediaType} />
            ))}
          </div>
          {page < totalPages && (
            <div className="flex justify-center mt-10">
              <Button
                variant="secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
