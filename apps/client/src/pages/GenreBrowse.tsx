import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { MediaCard } from '../components/MediaCard'
import { SkeletonGrid } from '../components/SkeletonCard'
import { Button } from '../components/Button'
import type { TMDBMovie, TMDBTVShow, TMDBPaginatedResponse } from '@streamtime/shared'

type AnyMedia = TMDBMovie | TMDBTVShow

export function GenreBrowse() {
  const { type, genreId } = useParams<{ type: string; genreId: string }>()
  const [searchParams] = useSearchParams()
  const genreName = searchParams.get('name') ?? 'Genre'
  const mediaType = type === 'tv' ? 'tv' : 'movie'

  const [items, setItems] = useState<AnyMedia[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Reset when genre or type changes
  useEffect(() => {
    setItems([])
    setPage(1)
    setLoading(true)
  }, [genreId, type])

  useEffect(() => {
    if (!genreId) return
    const setter = page === 1 ? setLoading : setLoadingMore
    setter(true)
    api.get<TMDBPaginatedResponse<AnyMedia>>('/api/tmdb/discover', {
      params: { type: mediaType, genreId, page },
    })
      .then((r) => {
        setItems((prev) => page === 1 ? r.data.results : [...prev, ...r.data.results])
        setTotalPages(r.data.total_pages)
      })
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }, [genreId, mediaType, page])

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[var(--st-text-muted)] text-sm mb-1">
          {mediaType === 'tv' ? 'TV Shows' : 'Movies'} · Genre
        </p>
        <h1 className="text-3xl font-bold text-white">{genreName}</h1>
      </div>

      {loading ? (
        <SkeletonGrid count={18} />
      ) : items.length === 0 ? (
        <p className="text-[var(--st-text-muted)]">No titles found for this genre.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => {
              const title = 'title' in item ? (item as TMDBMovie).title : (item as TMDBTVShow).name
              const year = 'release_date' in item
                ? (item as TMDBMovie).release_date?.slice(0, 4)
                : (item as TMDBTVShow).first_air_date?.slice(0, 4)
              return (
                <MediaCard
                  key={item.id}
                  id={item.id}
                  title={title}
                  posterPath={item.poster_path}
                  year={year}
                  mediaType={mediaType}
                  voteAverage={item.vote_average}
                />
              )
            })}
          </div>

          {page < totalPages && (
            <div className="flex justify-center mt-10">
              <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
