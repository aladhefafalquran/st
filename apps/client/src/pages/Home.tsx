import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { HeroBanner } from '../components/HeroBanner'
import { MediaRow } from '../components/MediaRow'
import { ContinueWatchingRow } from '../components/ContinueWatchingRow'
import { SkeletonRow } from '../components/SkeletonCard'
import type { TMDBMovie, TMDBTVShow, TMDBPaginatedResponse } from '@streamtime/shared'

type AnyMedia = (TMDBMovie | TMDBTVShow) & { media_type?: string }

export function Home() {
  const [trending, setTrending] = useState<AnyMedia[]>([])
  const [popularMovies, setPopularMovies] = useState<TMDBMovie[]>([])
  const [popularTV, setPopularTV] = useState<TMDBTVShow[]>([])
  const [topRated, setTopRated] = useState<TMDBMovie[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<TMDBPaginatedResponse<AnyMedia>>('/api/tmdb/trending'),
      api.get<TMDBPaginatedResponse<TMDBMovie>>('/api/tmdb/movies/popular'),
      api.get<TMDBPaginatedResponse<TMDBTVShow>>('/api/tmdb/tv/popular'),
      api.get<TMDBPaginatedResponse<TMDBMovie>>('/api/tmdb/movies/top-rated'),
    ]).then(([t, pm, pt, tr]) => {
      setTrending(t.data.results)
      setPopularMovies(pm.data.results)
      setPopularTV(pt.data.results)
      setTopRated(tr.data.results)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="pb-12">
        {/* Hero skeleton */}
        <div className="skeleton w-full h-[70vh]" style={{ borderRadius: 0 }} />
        <div className="mt-8">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    )
  }

  const hero = trending[0]
  const heroTitle = hero ? ('title' in hero ? (hero as TMDBMovie).title : (hero as TMDBTVShow).name) : ''
  const heroImdbId = hero?.external_ids?.imdb_id

  return (
    <div className="pb-12">
      {hero && (
        <HeroBanner
          id={hero.id}
          title={heroTitle}
          overview={hero.overview}
          backdropPath={hero.backdrop_path}
          mediaType={(hero.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv'}
          imdbId={heroImdbId}
        />
      )}
      <div className="mt-8">
        <ContinueWatchingRow />
        <MediaRow title="Trending" items={trending.slice(0, 20)} />
        <MediaRow title="Popular Movies" items={popularMovies} mediaType="movie" />
        <MediaRow title="Popular TV Shows" items={popularTV} mediaType="tv" />
        <MediaRow title="Top Rated Movies" items={topRated} />
      </div>
    </div>
  )
}
