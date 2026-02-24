import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, tmdbImg } from '../api/client'
import { usePlayerStore } from '../store/playerStore'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/Button'
import { Spinner } from '../components/Spinner'
import { MediaRow } from '../components/MediaRow'
import type { TMDBMovie } from '@streamtime/shared'
import { Link } from 'react-router-dom'

export function MovieDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setMedia = usePlayerStore((s) => s.setMedia)
  const { isAuthenticated } = useAuthStore()
  const [movie, setMovie] = useState<TMDBMovie | null>(null)
  const [similar, setSimilar] = useState<TMDBMovie[]>([])
  const [inWatchlist, setInWatchlist] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setSimilar([])
    api.get<TMDBMovie>(`/api/tmdb/movies/${id}`)
      .then((r) => setMovie(r.data))
      .finally(() => setLoading(false))
    api.get<{ results: TMDBMovie[] }>(`/api/tmdb/movies/${id}/similar`)
      .then((r) => setSimilar(r.data.results.slice(0, 20)))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!isAuthenticated || !id) return
    api.get('/api/watchlist/check', { params: { tmdbId: id, mediaType: 'movie' } })
      .then((r) => setInWatchlist(r.data.inWatchlist))
      .catch(() => {})
  }, [isAuthenticated, id])

  function handleWatch() {
    if (!movie) return
    const imdbId = movie.external_ids?.imdb_id
    if (!imdbId) return
    setMedia({ tmdbId: movie.id, mediaType: 'movie', title: movie.title, imdbId })
    navigate('/watch')
  }

  async function toggleWatchlist() {
    if (!movie) return
    if (inWatchlist) {
      await api.delete('/api/watchlist', { data: { tmdbId: movie.id, mediaType: 'movie' } })
      setInWatchlist(false)
    } else {
      await api.post('/api/watchlist', { tmdbId: movie.id, mediaType: 'movie', title: movie.title, posterPath: movie.poster_path })
      setInWatchlist(true)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>
  if (!movie) return <div className="pt-20 px-8 text-[var(--st-text-muted)]">Movie not found.</div>

  const backdrop = tmdbImg(movie.backdrop_path, 'original')
  const poster = tmdbImg(movie.poster_path, 'w500')
  const year = movie.release_date?.slice(0, 4)
  const trailer = movie.videos?.results?.find((v) => v.type === 'Trailer' && v.site === 'YouTube')
  const imdbId = movie.external_ids?.imdb_id

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      <div className="relative h-[50vh] overflow-hidden">
        {backdrop && <img src={backdrop} alt={movie.title} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-[var(--st-bg)]/40 to-black/20" />
      </div>

      <div className="px-4 sm:px-8 -mt-20 sm:-mt-32 relative z-10 pb-16">
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 sm:w-56 mx-auto sm:mx-0">
            {poster && <img src={poster} alt={movie.title} className="w-full rounded-xl shadow-2xl" />}
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
                <Link
                  key={g.id}
                  to={`/browse/movie/genre/${g.id}?name=${encodeURIComponent(g.name)}`}
                  className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full transition-colors"
                >
                  {g.name}
                </Link>
              ))}
            </div>
            <p className="text-[var(--st-text)] text-base leading-relaxed mb-6 max-w-2xl">{movie.overview}</p>

            <div className="flex flex-wrap gap-3 mb-8">
              <Button onClick={handleWatch} disabled={!imdbId}>▶ Watch Now</Button>
              {isAuthenticated && (
                <Button variant="secondary" onClick={toggleWatchlist}>
                  {inWatchlist ? '✓ In Watchlist' : '+ Watchlist'}
                </Button>
              )}
              {trailer && (
                <a href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary">▶ Trailer</Button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Cast */}
        {(movie.credits?.cast?.length ?? 0) > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-white mb-4">Cast</h2>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {movie.credits!.cast.slice(0, 12).map((person) => (
                <div key={person.id} className="flex-shrink-0 w-24 text-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-[var(--st-surface-2)] mb-2">
                    {person.profile_path ? (
                      <img src={tmdbImg(person.profile_path, 'w185')!} alt={person.name} className="w-full h-full object-cover" />
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

      {/* More Like This */}
      {similar.length > 0 && (
        <div className="pb-12">
          <MediaRow title="More Like This" items={similar} mediaType="movie" />
        </div>
      )}
    </div>
  )
}
