import { useEffect, useState } from 'react';
import { HeroBanner } from '@/components/media/HeroBanner';
import { MediaRow } from '@/components/media/MediaRow';
import { Spinner } from '@/components/ui/Spinner';
import { getTrending, getPopularMovies, getPopularTV, getTopRatedMovies } from '@/api/tmdb';
import { TMDBMultiResult, TMDBMovie, TMDBTVShow } from '@streamtime/shared';

function toMulti(items: TMDBMovie[], mediaType: 'movie'): TMDBMultiResult[];
function toMulti(items: TMDBTVShow[], mediaType: 'tv'): TMDBMultiResult[];
function toMulti(items: (TMDBMovie | TMDBTVShow)[], mediaType: 'movie' | 'tv'): TMDBMultiResult[] {
  return items.map((item) => ({
    ...item,
    media_type: mediaType,
    title: 'title' in item ? item.title : undefined,
    name: 'name' in item ? item.name : undefined,
    release_date: 'release_date' in item ? item.release_date : undefined,
    first_air_date: 'first_air_date' in item ? item.first_air_date : undefined,
  }));
}

export function Home() {
  const [trending, setTrending] = useState<TMDBMultiResult[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDBMultiResult[]>([]);
  const [popularTV, setPopularTV] = useState<TMDBMultiResult[]>([]);
  const [topRated, setTopRated] = useState<TMDBMultiResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTrending(),
      getPopularMovies(),
      getPopularTV(),
      getTopRatedMovies(),
    ])
      .then(([t, pm, pt, tr]) => {
        setTrending(t.results.slice(0, 20));
        setPopularMovies(toMulti(pm.results, 'movie'));
        setPopularTV(toMulti(pt.results, 'tv'));
        setTopRated(toMulti(tr.results, 'movie'));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="pb-16">
      {trending.length > 0 && <HeroBanner item={trending[0]} />}
      <div className="-mt-16 relative z-10">
        <MediaRow title="Trending Now" items={trending.slice(1)} />
        <MediaRow title="Popular Movies" items={popularMovies} mediaType="movie" />
        <MediaRow title="Popular TV Shows" items={popularTV} mediaType="tv" />
        <MediaRow title="Top Rated Movies" items={topRated} mediaType="movie" />
      </div>
    </div>
  );
}
