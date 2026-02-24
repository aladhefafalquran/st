import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTVDetail, getTVSeason, imgUrl } from '@/api/tmdb';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useWatchlist } from '@/hooks/useWatchlist';
import { usePlayerStore } from '@/store/playerStore';
import { TMDBTVShow, TMDBEpisode } from '@streamtime/shared';

interface EpisodeCardProps {
  ep: TMDBEpisode;
  onPlay: (ep: TMDBEpisode) => void;
}

function EpisodeCard({ ep, onPlay }: EpisodeCardProps) {
  return (
    <div
      onClick={() => onPlay(ep)}
      className="group cursor-pointer bg-[var(--st-surface)] rounded-xl overflow-hidden hover:ring-2 hover:ring-[var(--st-accent)] transition-all hover:scale-[1.03] hover:shadow-xl"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[var(--st-surface-2)]">
        {ep.still_path ? (
          <img
            src={imgUrl(ep.still_path, 'w300') ?? ''}
            alt={ep.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--st-text-muted)] text-4xl">
            ▶
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[var(--st-accent)] flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Episode number badge */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded">
          E{ep.episode_number}
        </div>

        {/* Runtime badge */}
        {ep.runtime && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
            {ep.runtime}m
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-white text-sm font-semibold truncate">{ep.name}</p>
        {ep.overview && (
          <p className="text-[var(--st-text-muted)] text-xs mt-1 line-clamp-2 leading-relaxed">
            {ep.overview}
          </p>
        )}
      </div>
    </div>
  );
}

export function TVDetail() {
  const { id } = useParams<{ id: string }>();
  const [show, setShow] = useState<TMDBTVShow | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setMedia = usePlayerStore((s) => s.setMedia);

  const tmdbId = Number(id);
  const { inWatchlist, toggle } = useWatchlist(tmdbId, 'tv');

  const rawImdbId = (show?.external_ids as { imdb_id?: string } | undefined)?.imdb_id ?? '';
  const imdbId = rawImdbId;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTVDetail(Number(id))
      .then((s) => setShow(s))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingEpisodes(true);
    getTVSeason(Number(id), selectedSeason)
      .then(({ episodes }) => setEpisodes(episodes))
      .catch(() => setEpisodes([]))
      .finally(() => setLoadingEpisodes(false));
  }, [id, selectedSeason]);

  function handlePlay(ep: TMDBEpisode) {
    if (!show || !imdbId) return;
    setMedia({
      tmdbId: Number(id),
      mediaType: 'tv',
      title: `${show.name} S${ep.season_number}E${ep.episode_number} — ${ep.name}`,
      imdbId,
      season: ep.season_number,
      episode: ep.episode_number,
    });
    navigate('/watch');
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!show) return <div className="pt-20 px-8 text-[var(--st-text-muted)]">Show not found.</div>;

  const backdrop = imgUrl(show.backdrop_path, 'original');
  const poster = imgUrl(show.poster_path, 'w500');
  const year = show.first_air_date?.slice(0, 4);

  return (
    <div className="min-h-screen">
      <div className="relative h-[50vh] overflow-hidden">
        {backdrop && <img src={backdrop} alt={show.name} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-[var(--st-bg)]/40 to-black/20" />
      </div>

      <div className="px-4 sm:px-8 -mt-32 relative z-10 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="flex-shrink-0 w-48 sm:w-56">
            {poster && <img src={poster} alt={show.name} className="w-full rounded-xl shadow-2xl" />}
          </div>
          <div className="flex-1 pt-4 sm:pt-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{show.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--st-text-muted)] mb-4">
              {year && <span>{year}</span>}
              {show.number_of_seasons && <span>{show.number_of_seasons} seasons</span>}
              <span className="flex items-center gap-1">
                <span className="text-yellow-400">★</span>
                {show.vote_average.toFixed(1)}
              </span>
              {show.genres?.map((g) => (
                <span key={g.id} className="bg-white/10 px-2 py-0.5 rounded-full">{g.name}</span>
              ))}
            </div>
            <p className="text-[var(--st-text)] text-base leading-relaxed mb-6 max-w-2xl">{show.overview}</p>
            <Button onClick={() => toggle(show.name, show.poster_path)} variant={inWatchlist ? 'secondary' : 'primary'}>
              {inWatchlist ? '✓ In Watchlist' : '+ Watchlist'}
            </Button>
            {!imdbId && (
              <p className="text-yellow-500/70 text-xs mt-3">
                No IMDB ID found — streaming may not be available.
              </p>
            )}
          </div>
        </div>

        {/* Season selector + episodes */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-white mb-4">Episodes</h2>
          {show.seasons && show.seasons.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-6">
              {show.seasons
                .filter((s) => s.season_number > 0)
                .map((s) => (
                  <button
                    key={s.season_number}
                    onClick={() => setSelectedSeason(s.season_number)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                      selectedSeason === s.season_number
                        ? 'bg-[var(--st-accent)] text-white'
                        : 'bg-white/10 text-[var(--st-text-muted)] hover:bg-white/20'
                    }`}
                  >
                    Season {s.season_number}
                  </button>
                ))}
            </div>
          )}

          {loadingEpisodes ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {episodes.map((ep) => (
                <EpisodeCard
                  key={ep.episode_number}
                  ep={ep}
                  onPlay={handlePlay}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
