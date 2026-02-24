import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerStore } from '../store/playerStore'
import { useAuthStore } from '../store/authStore'
import { VideoPlayer } from '../components/VideoPlayer'
import { Spinner } from '../components/Spinner'
import { api, tmdbImg } from '../api/client'
import { saveContinueWatching } from '../utils/continueWatching'
import type { TMDBTVShow, TMDBMovie, TMDBSeason, TMDBEpisode } from '@streamtime/shared'

export function Watch() {
  const { tmdbId, mediaType, title, imdbId, season, episode, setMedia } = usePlayerStore()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const [show, setShow] = useState<TMDBTVShow | null>(null)
  const [selectedSeason, setSelectedSeason] = useState(season ?? 1)
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([])
  const [epLoading, setEpLoading] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [wlLoading, setWlLoading] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const watchStartRef = useRef<number>(Date.now())
  const dismissedRef = useRef(false)

  useEffect(() => {
    if (!tmdbId) navigate('/')
  }, [tmdbId, navigate])

  // Fetch show data for TV + save continue watching once poster is known
  useEffect(() => {
    if (mediaType !== 'tv' || !tmdbId || !title || !season || !episode) return
    api.get<TMDBTVShow>(`/api/tmdb/tv/${tmdbId}`).then((r) => {
      setShow(r.data)
      saveContinueWatching({ mediaType: 'tv', tmdbId, title, posterPath: r.data.poster_path, imdbId, season, episode })
    })
  }, [tmdbId, mediaType, title, season, episode])

  // Save movies to continue watching
  useEffect(() => {
    if (mediaType !== 'movie' || !tmdbId || !title || !imdbId) return
    api.get<TMDBMovie>(`/api/tmdb/movies/${tmdbId}`).then((r) => {
      saveContinueWatching({ mediaType: 'movie', tmdbId, title, posterPath: r.data.poster_path, imdbId })
    })
  }, [tmdbId, mediaType, title, imdbId])

  // Fetch episodes when season changes
  useEffect(() => {
    if (mediaType !== 'tv' || !tmdbId) return
    setEpLoading(true)
    api.get<TMDBSeason>(`/api/tmdb/tv/${tmdbId}/season/${selectedSeason}`)
      .then((r) => setEpisodes(r.data.episodes ?? []))
      .finally(() => setEpLoading(false))
  }, [tmdbId, mediaType, selectedSeason])

  // Check watchlist status for logged-in users
  useEffect(() => {
    if (!isAuthenticated || !tmdbId || !mediaType) return
    api.get('/api/watchlist/check', { params: { tmdbId, mediaType } })
      .then((r) => setInWatchlist(r.data.inWatchlist))
      .catch(() => {})
  }, [isAuthenticated, tmdbId, mediaType])

  // Reset watch timer + dismiss state when episode changes
  useEffect(() => {
    watchStartRef.current = Date.now()
    dismissedRef.current = false
    setCountdown(null)
  }, [tmdbId, season, episode])

  // Derive next episode (within same season)
  const currentEpIdx = episodes.findIndex(
    (ep) => ep.season_number === season && ep.episode_number === episode
  )
  const nextEpisode = currentEpIdx >= 0 && currentEpIdx < episodes.length - 1
    ? episodes[currentEpIdx + 1]
    : null

  // Watch-time monitor — triggers countdown near estimated end
  useEffect(() => {
    if (mediaType !== 'tv' || !nextEpisode) return
    const currentEp = episodes[currentEpIdx]
    // Trigger 90s before estimated end; fallback to 20 min if no runtime
    const runtimeSec = currentEp?.runtime ? currentEp.runtime * 60 : 20 * 60
    const threshold = Math.max(runtimeSec - 90, 60)

    const iv = setInterval(() => {
      if (dismissedRef.current || countdown !== null) return
      const elapsed = (Date.now() - watchStartRef.current) / 1000
      if (elapsed >= threshold) setCountdown(10)
    }, 1000)
    return () => clearInterval(iv)
  }, [mediaType, nextEpisode, episodes, currentEpIdx, countdown])

  // Countdown ticker
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      if (nextEpisode) handleEpisodeClick(nextEpisode)
      setCountdown(null)
      return
    }
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function toggleWatchlist() {
    if (!isAuthenticated) { navigate('/login'); return }
    if (!tmdbId || !title || !mediaType) return
    setWlLoading(true)
    try {
      const posterPath = show?.poster_path ?? null
      if (inWatchlist) {
        await api.delete('/api/watchlist', { data: { tmdbId, mediaType } })
        setInWatchlist(false)
      } else {
        await api.post('/api/watchlist', { tmdbId, mediaType, title, posterPath })
        setInWatchlist(true)
      }
    } finally {
      setWlLoading(false)
    }
  }

  function handleEpisodeClick(ep: TMDBEpisode) {
    if (!tmdbId || !imdbId) return
    setMedia({
      tmdbId,
      mediaType: 'tv',
      title: title!,
      imdbId,
      season: ep.season_number,
      episode: ep.episode_number,
    })
  }

  if (!tmdbId || !mediaType || !title || !imdbId) return null

  const seasons = show?.seasons?.filter((s) => s.season_number > 0) ?? []

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/80">
        <button onClick={() => navigate(-1)} className="text-white hover:text-white/80 transition-colors cursor-pointer shrink-0">
          ← Back
        </button>
        <span className="text-white font-medium flex-1 truncate text-sm sm:text-base">
          {title}{season && episode ? ` · S${season}E${episode}` : ''}
        </span>
        <button
          onClick={toggleWatchlist}
          disabled={wlLoading}
          title={inWatchlist ? 'Remove from Watch Later' : 'Save to Watch Later'}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
            inWatchlist
              ? 'bg-[var(--st-accent)] text-white hover:bg-[var(--st-accent-hover)]'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill={inWatchlist ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span className="hidden sm:inline">{inWatchlist ? 'Saved' : 'Watch Later'}</span>
        </button>
      </div>

      {/* Player */}
      <div className="flex justify-center p-4">
        <div className="w-full max-w-6xl">
          <VideoPlayer
            key={`${tmdbId}-${season}-${episode}`}
            tmdbId={tmdbId}
            mediaType={mediaType}
            title={title}
            imdbId={imdbId}
            season={season ?? undefined}
            episode={episode ?? undefined}
            backdropPath={show?.backdrop_path}
            posterPath={show?.poster_path}
          />
        </div>
      </div>

      {/* Season / Episode panel — TV only */}
      {mediaType === 'tv' && (
        <div className="w-full max-w-6xl mx-auto px-4 pb-12">
          {/* Season pills */}
          {seasons.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-5">
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

          {/* Episode grid */}
          {epLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {episodes.map((ep) => {
                const isActive = ep.season_number === season && ep.episode_number === episode
                return (
                  <button
                    key={ep.id}
                    onClick={() => handleEpisodeClick(ep)}
                    className={`group text-left rounded-lg overflow-hidden transition-colors cursor-pointer border ${
                      isActive
                        ? 'border-[var(--st-accent)] bg-[var(--st-surface-2)]'
                        : 'border-transparent bg-[var(--st-surface)] hover:bg-[var(--st-surface-2)]'
                    }`}
                  >
                    <div className="relative aspect-video bg-black overflow-hidden">
                      {ep.still_path || show?.backdrop_path ? (
                        <img
                          src={tmdbImg(ep.still_path ?? show?.backdrop_path ?? null, 'w300')!}
                          alt={ep.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--st-text-muted)] text-2xl">
                          ▶
                        </div>
                      )}
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity bg-black/50 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <span className="text-white text-3xl">▶</span>
                      </div>
                      <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        E{ep.episode_number}
                      </span>
                      {isActive && (
                        <span className="absolute top-1.5 right-1.5 bg-[var(--st-accent)] text-white text-xs px-1.5 py-0.5 rounded">
                          Playing
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className={`text-xs font-medium truncate ${isActive ? 'text-[var(--st-accent)]' : 'text-[var(--st-text)]'}`}>
                        {ep.name}
                      </p>
                      {ep.runtime && (
                        <p className="text-xs text-[var(--st-text-muted)]">{ep.runtime}m</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Auto-play next episode overlay */}
      {countdown !== null && nextEpisode && (
        <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-72 z-50 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-2xl p-4 sm:p-5 shadow-2xl animate-in">
          <p className="text-xs text-[var(--st-text-muted)] uppercase tracking-wider mb-1">Up Next</p>
          <p className="text-white font-semibold text-sm truncate mb-0.5">
            E{nextEpisode.episode_number}: {nextEpisode.name}
          </p>
          {nextEpisode.runtime && (
            <p className="text-[var(--st-text-muted)] text-xs mb-4">{nextEpisode.runtime} min</p>
          )}

          <div className="flex items-center gap-3">
            {/* Countdown ring */}
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="24" fill="none"
                  stroke="var(--st-accent)" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - countdown / 10)}`}
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                {countdown}
              </span>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <button
                onClick={() => { if (nextEpisode) handleEpisodeClick(nextEpisode); setCountdown(null) }}
                className="w-full bg-[var(--st-accent)] hover:bg-[var(--st-accent-hover)] text-white text-sm font-medium py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Play Now
              </button>
              <button
                onClick={() => { dismissedRef.current = true; setCountdown(null) }}
                className="w-full bg-white/10 hover:bg-white/20 text-[var(--st-text-muted)] text-sm py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
