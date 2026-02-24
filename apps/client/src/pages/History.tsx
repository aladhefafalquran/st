import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, tmdbImg } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { usePlayerStore } from '../store/playerStore'
import { Spinner } from '../components/Spinner'
import type { WatchHistoryItem, TMDBMovie, TMDBTVShow } from '@streamtime/shared'

export function History() {
  const { isAuthenticated } = useAuthStore()
  const setMedia = usePlayerStore((s) => s.setMedia)
  const navigate = useNavigate()
  const [items, setItems] = useState<WatchHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return }
    api.get<WatchHistoryItem[]>('/api/history')
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false))
  }, [isAuthenticated, navigate])

  async function handleDelete(e: React.MouseEvent, item: WatchHistoryItem) {
    e.stopPropagation()
    setDeleting(item.id)
    try {
      await api.delete(`/api/history/${item.id}`)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } finally {
      setDeleting(null)
    }
  }

  async function handlePlay(item: WatchHistoryItem) {
    setLaunching(item.id)
    try {
      if (item.mediaType === 'movie') {
        const r = await api.get<TMDBMovie>(`/api/tmdb/movies/${item.tmdbId}`)
        const imdbId = r.data.external_ids?.imdb_id
        if (!imdbId) { navigate(`/movie/${item.tmdbId}`); return }
        setMedia({ tmdbId: item.tmdbId, mediaType: 'movie', title: item.title, imdbId })
      } else {
        const r = await api.get<TMDBTVShow>(`/api/tmdb/tv/${item.tmdbId}`)
        const imdbId = r.data.external_ids?.imdb_id
        if (!imdbId) { navigate(`/tv/${item.tmdbId}`); return }
        setMedia({
          tmdbId: item.tmdbId,
          mediaType: 'tv',
          title: item.title,
          imdbId,
          season: item.seasonNumber ?? undefined,
          episode: item.episodeNumber ?? undefined,
        })
      }
      navigate('/watch')
    } finally {
      setLaunching(null)
    }
  }

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      <h1 className="text-3xl font-bold text-white mb-8">Watch History</h1>
      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <p className="text-[var(--st-text-muted)]">No history yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const pct = item.durationSeconds > 0
              ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
              : 0
            const isLaunching = launching === item.id
            return (
              <button
                key={item.id}
                onClick={() => handlePlay(item)}
                disabled={!!launching}
                className="flex gap-4 bg-[var(--st-surface)] rounded-xl p-3 hover:bg-[var(--st-surface-2)] transition-colors border border-[var(--st-border)] text-left cursor-pointer disabled:opacity-60 w-full"
              >
                <div className="relative w-20 shrink-0 rounded-lg overflow-hidden">
                  {item.posterPath ? (
                    <img src={tmdbImg(item.posterPath, 'w185')!} alt={item.title} className="w-full" />
                  ) : (
                    <div className="aspect-[2/3] bg-[var(--st-surface-2)] flex items-center justify-center text-sm text-[var(--st-text-muted)]">?</div>
                  )}
                  {pct > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div className="h-full bg-[var(--st-accent)]" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {isLaunching && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{item.title}</p>
                  {item.seasonNumber && item.episodeNumber && (
                    <p className="text-sm text-[var(--st-accent)] font-medium">S{item.seasonNumber} · E{item.episodeNumber}</p>
                  )}
                  <p className="text-xs text-[var(--st-text-muted)] mt-1">
                    {item.progressSeconds > 0 ? `${Math.round(item.progressSeconds / 60)}m watched` : 'Started'}
                    {' · '}{new Date(item.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-center shrink-0">
                  <svg className="w-5 h-5 text-[var(--st-text-muted)]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <button
                    onClick={(e) => handleDelete(e, item)}
                    disabled={deleting === item.id}
                    title="Remove from history"
                    className="p-1.5 rounded-lg text-[var(--st-text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {deleting === item.id
                      ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    }
                  </button>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
