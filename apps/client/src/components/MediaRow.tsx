import { useRef } from 'react'
import { MediaCard } from './MediaCard'
import type { TMDBMovie, TMDBTVShow, TMDBSearchResult } from '@streamtime/shared'

type MediaItem = TMDBMovie | TMDBTVShow | TMDBSearchResult

function getInfo(item: MediaItem) {
  const title = 'title' in item ? (item as TMDBMovie).title : (item as TMDBTVShow).name
  const year = 'release_date' in item
    ? (item as TMDBMovie).release_date?.slice(0, 4)
    : 'first_air_date' in item
    ? (item as TMDBTVShow).first_air_date?.slice(0, 4)
    : undefined
  const mediaType: 'movie' | 'tv' = 'media_type' in item
    ? ((item as TMDBSearchResult).media_type === 'tv' ? 'tv' : 'movie')
    : 'title' in item ? 'movie' : 'tv'
  const voteAverage = item.vote_average
  return { title, year, mediaType, voteAverage }
}

interface MediaRowProps {
  title: string
  items: MediaItem[]
  mediaType?: 'movie' | 'tv'
}

export function MediaRow({ title, items, mediaType }: MediaRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    if (!rowRef.current) return
    rowRef.current.scrollBy({ left: dir === 'right' ? 400 : -400, behavior: 'smooth' })
  }

  if (!items.length) return null

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[var(--st-text)] mb-3 px-4 sm:px-8">{title}</h2>
      <div className="relative group/row">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-[var(--st-bg)] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div ref={rowRef} className="flex gap-3 overflow-x-auto hide-scrollbar px-4 sm:px-8 pb-2">
          {items.map((item) => {
            const { title: t, year, mediaType: mt, voteAverage } = getInfo(item)
            return (
              <MediaCard
                key={item.id}
                id={item.id}
                title={t || 'Untitled'}
                posterPath={item.poster_path}
                year={year}
                mediaType={mediaType ?? mt}
                voteAverage={voteAverage}
              />
            )
          })}
        </div>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[var(--st-bg)] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  )
}
