import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, tmdbImg } from '../api/client'
import { usePlayerStore } from '../store/playerStore'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/Button'
import { Spinner } from '../components/Spinner'
import { MediaRow } from '../components/MediaRow'
import { Link } from 'react-router-dom'
import type { TMDBTVShow, TMDBSeason, TMDBEpisode } from '@streamtime/shared'

export function TVDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setMedia = usePlayerStore((s) => s.setMedia)
  const { isAuthenticated } = useAuthStore()
  const [show, setShow] = useState<TMDBTVShow | null>(null)
  const [similar, setSimilar] = useState<TMDBTVShow[]>([])
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([])
  const [inWatchlist, setInWatchlist] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)

  useEffect(() => {
    setLoading(true)
    setSimilar([])
    api.get<TMDBTVShow>(`/api/tmdb/tv/${id}`)
      .then((r) => {
        setShow(r.data)
        const first = r.data.seasons?.find((s) => s.season_number > 0)?.season_number ?? 1
        setSelectedSeason(first)
      })
      .finally(() => setLoading(false))
    api.get<{ results: TMDBTVShow[] }>(`/api/tmdb/tv/${id}/similar`)
      .then((r) => setSimilar(r.data.results.slice(0, 20)))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!isAuthenticated || !id) return
    api.get('/api/watchlist/check', { params: { tmdbId: id, mediaType: 'tv' } })
      .then((r) => setInWatchlist(r.data.inWatchlist))
      .catch(() => {})
  }, [isAuthenticated, id])

  useEffect(() => {
    if (!id) return
    setLoadingEpisodes(true)
    api.get<TMDBSeason>(`/api/tmdb/tv/${id}/season/${selectedSeason}`)
      .then((r) => setEpisodes(r.data.episodes ?? []))
      .finally(() => setLoadingEpisodes(false))
  }, [id, selectedSeason])

  function handlePlay(ep: TMDBEpisode) {
    if (!show) return
    const imdbId = show.external_ids?.imdb_id
    if (!imdbId) return
    setMedia({ tmdbId: show.id, mediaType: 'tv', title: show.name, imdbId, season: ep.season_number, episode: ep.episode_number })
    navigate('/watch')
  }

  async function toggleWatchlist() {
    if (!show) return
    if (inWatchlist) {
      await api.delete('/api/watchlist', { data: { tmdbId: show.id, mediaType: 'tv' } })
      setInWatchlist(false)
    } else {
      await api.post('/api/watchlist', { tmdbId: show.id, mediaType: 'tv', title: show.name, posterPath: show.poster_path })
      setInWatchlist(true)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>
  if (!show) return <div className="pt-20 px-8 text-[var(--st-text-muted)]">Show not found.</div>

  const backdrop = tmdbImg(show.backdrop_path, 'original')
  const poster = tmdbImg(show.poster_path, 'w500')
  const year = show.first_air_date?.slice(0, 4)
  const imdbId = show.external_ids?.imdb_id
  const seasons = show.seasons?.filter((s) => s.season_number > 0) ?? []

  return (
    <div className="min-h-screen">
      <div className="relative h-[50vh] overflow-hidden">
        {backdrop && <img src={backdrop} alt={show.name} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-[var(--st-bg)]/40 to-black/20" />
      </div>

      <div className="px-4 sm:px-8 -mt-20 sm:-mt-32 relative z-10 pb-16">
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-8">
          <div className="flex-shrink-0 w-36 sm:w-56 mx-auto sm:mx-0">
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
                <Link
                  key={g.id}
                  to={`/browse/tv/genre/${g.id}?name=${encodeURIComponent(g.name)}`}
                  className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full transition-colors"
                >{g.name}</Link>
              ))}
            </div>
            <p className="text-[var(--st-text)] text-base leading-relaxed mb-6 max-w-2xl">{show.overview}</p>
            {isAuthenticated && (
              <Button onClick={toggleWatchlist} variant={inWatchlist ? 'secondary' : 'primary'}>
                {inWatchlist ? '✓ In Watchlist' : '+ Watchlist'}
              </Button>
            )}
            {!imdbId && (
              <p className="text-yellow-400/70 text-xs mt-3">No IMDB ID — streaming may not be available.</p>
            )}
          </div>
        </div>

        {/* Season selector + episodes */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-white mb-4">Episodes</h2>
          {seasons.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-6">
              {seasons.map((s) => (
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
                <button
                  key={ep.episode_number}
                  onClick={() => handlePlay(ep)}
                  className="group text-left bg-[var(--st-surface)] rounded-lg overflow-hidden hover:bg-[var(--st-surface-2)] transition-colors cursor-pointer"
                >
                  <div className="relative aspect-video bg-[var(--st-bg)] overflow-hidden">
                    {ep.still_path || show.backdrop_path ? (
                      <img
                        src={tmdbImg(ep.still_path ?? show.backdrop_path, 'w300')!}
                        alt={ep.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--st-text-muted)] text-2xl">▶</div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                      <span className="text-white text-3xl">▶</span>
                    </div>
                    <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      E{ep.episode_number}
                    </span>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-[var(--st-text)] truncate">{ep.name}</p>
                    {ep.runtime && <p className="text-xs text-[var(--st-text-muted)]">{ep.runtime}m</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* More Like This */}
      {similar.length > 0 && (
        <div className="pb-12">
          <MediaRow title="More Like This" items={similar} mediaType="tv" />
        </div>
      )}
    </div>
  )
}
