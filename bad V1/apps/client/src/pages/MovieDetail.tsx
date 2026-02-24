import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMovieDetail, imgUrl } from '@/api/tmdb';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useWatchlist } from '@/hooks/useWatchlist';
import { usePlayerStore } from '@/store/playerStore';
import { TMDBMovie } from '@streamtime/shared';
import { useNavigate } from 'react-router-dom';

export function MovieDetail() {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setMedia = usePlayerStore((s) => s.setMedia);

  const tmdbId = Number(id);
  const { inWatchlist, toggle } = useWatchlist(tmdbId, 'movie');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMovieDetail(Number(id))
      .then((m) => setMovie(m))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  function handleWatch() {
    if (!movie?.imdb_id) return;
    setMedia({
      tmdbId: Number(id),
      mediaType: 'movie',
      title: movie.title,
      imdbId: movie.imdb_id,
    });
    navigate('/watch');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!movie) return <div className="pt-20 px-8 text-[var(--st-text-muted)]">Movie not found.</div>;

  const backdrop = imgUrl(movie.backdrop_path, 'original');
  const poster = imgUrl(movie.poster_path, 'w500');
  const year = movie.release_date?.slice(0, 4);
  const trailer = movie.videos?.results?.find((v) => v.type === 'Trailer' && v.site === 'YouTube');

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      <div className="relative h-[50vh] overflow-hidden">
        {backdrop && (
          <img src={backdrop} alt={movie.title} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-[var(--st-bg)]/40 to-black/20" />
      </div>

      <div className="px-4 sm:px-8 -mt-32 relative z-10 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 w-48 sm:w-56">
            {poster && (
              <img src={poster} alt={movie.title} className="w-full rounded-xl shadow-2xl" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pt-4 sm:pt-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{movie.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--st-text-muted)] mb-4">
              {year && <span>{year}</span>}
              {movie.runtime && <span>{movie.runtime} min</span>}
              <span className="flex items-center gap-1">
                <span className="text-yellow-400">★</span>
                {movie.vote_average.toFixed(1)}
              </span>
              {movie.genres?.map((g) => (
                <span key={g.id} className="bg-white/10 px-2 py-0.5 rounded-full">{g.name}</span>
              ))}
            </div>
            <p className="text-[var(--st-text)] text-base leading-relaxed mb-6 max-w-2xl">
              {movie.overview}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              <Button onClick={handleWatch} variant="primary" disabled={!movie.imdb_id}>
                ▶ Watch Now
              </Button>
              <Button
                onClick={() => toggle(movie.title, movie.poster_path)}
                variant={inWatchlist ? 'secondary' : 'secondary'}
              >
                {inWatchlist ? '✓ In Watchlist' : '+ Watchlist'}
              </Button>
              {trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary">▶ Trailer</Button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Cast */}
        {movie.credits?.cast && movie.credits.cast.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-white mb-4">Cast</h2>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {movie.credits.cast.slice(0, 12).map((person) => (
                <div key={person.id} className="flex-shrink-0 w-24 text-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-[var(--st-surface-2)] mb-2">
                    {person.profile_path ? (
                      <img
                        src={imgUrl(person.profile_path, 'w185') ?? ''}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                    )}
                  </div>
                  <p className="text-xs text-white font-medium truncate">{person.name}</p>
                  <p className="text-xs text-[var(--st-text-muted)] truncate">{person.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
