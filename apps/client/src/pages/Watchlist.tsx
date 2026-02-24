import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { MediaCard } from '../components/MediaCard'
import { Spinner } from '../components/Spinner'
import type { WatchlistItem } from '@streamtime/shared'

export function Watchlist() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return }
    api.get<WatchlistItem[]>('/api/watchlist')
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false))
  }, [isAuthenticated, navigate])

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      <h1 className="text-3xl font-bold text-white mb-8">My Watchlist</h1>
      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <p className="text-[var(--st-text-muted)]">Your watchlist is empty.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              id={item.tmdbId}
              title={item.title}
              posterPath={item.posterPath}
              mediaType={item.mediaType as 'movie' | 'tv'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
