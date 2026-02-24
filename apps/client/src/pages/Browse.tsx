import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { MediaCard } from '../components/MediaCard'
import { SkeletonGrid } from '../components/SkeletonCard'
import { Button } from '../components/Button'
import type { TMDBMovie, TMDBTVShow, TMDBPaginatedResponse } from '@streamtime/shared'

export function Browse() {
  const { type } = useParams<{ type: string }>()
  const isTV = type === 'tv'
  const mediaType = isTV ? 'tv' : 'movie'
  const [items, setItems] = useState<(TMDBMovie | TMDBTVShow)[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    setItems([])
    setPage(1)
    setLoading(true)
  }, [type])

  useEffect(() => {
    const endpoint = isTV ? '/api/tmdb/tv/popular' : '/api/tmdb/movies/popular'
    const setter = page === 1 ? setLoading : setLoadingMore
    setter(true)
    api.get<TMDBPaginatedResponse<TMDBMovie | TMDBTVShow>>(endpoint, { params: { page } })
      .then((r) => {
        setItems((prev) => page === 1 ? r.data.results : [...prev, ...r.data.results])
        setTotalPages(r.data.total_pages)
      })
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }, [isTV, page])

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      <h1 className="text-3xl font-bold text-white mb-8">{isTV ? 'TV Shows' : 'Movies'}</h1>
      {loading ? (
        <SkeletonGrid count={18} />
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
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
