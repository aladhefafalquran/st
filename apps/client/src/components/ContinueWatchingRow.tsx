import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tmdbImg } from '../api/client'
import { usePlayerStore } from '../store/playerStore'
import { getContinueWatching, removeContinueWatching } from '../utils/continueWatching'
import type { ContinueWatchingItem } from '../utils/continueWatching'

export function ContinueWatchingRow() {
  const [items, setItems] = useState<ContinueWatchingItem[]>(getContinueWatching)
  const rowRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const setMedia = usePlayerStore((s) => s.setMedia)

  if (!items.length) return null

  function scroll(dir: 'left' | 'right') {
    rowRef.current?.scrollBy({ left: dir === 'right' ? 400 : -400, behavior: 'smooth' })
  }

  function handleClick(item: ContinueWatchingItem) {
    setMedia({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      imdbId: item.imdbId,
      season: item.season,
      episode: item.episode,
    })
    navigate('/watch')
  }

  function handleRemove(e: React.MouseEvent, tmdbId: number) {
    e.stopPropagation()
    removeContinueWatching(tmdbId)
    setItems((prev) => prev.filter((i) => i.tmdbId !== tmdbId))
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[var(--st-text)] mb-3 px-4 sm:px-8">Continue Watching</h2>
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
            const poster = tmdbImg(item.posterPath, 'w342')
            return (
              <div key={item.tmdbId} className="group/card flex-shrink-0 w-36 sm:w-44 relative">
                <button
                  onClick={() => handleClick(item)}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="relative overflow-hidden rounded-lg bg-[var(--st-surface-2)] aspect-[2/3]">
                    {poster ? (
                      <img
                        src={poster}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--st-text-muted)] text-xs text-center p-2">
                        {item.title}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                    {/* Badge */}
                    <div className="absolute bottom-2 left-2 bg-[var(--st-accent)] text-white text-xs font-medium px-1.5 py-0.5 rounded">
                      {item.mediaType === 'movie' ? 'Movie' : `S${item.season} E${item.episode}`}
                    </div>
                  </div>
                  <div className="mt-2 px-0.5">
                    <p className="text-sm font-medium text-[var(--st-text)] truncate">{item.title}</p>
                    <p className="text-xs text-[var(--st-text-muted)]">
                      {item.mediaType === 'movie' ? 'Movie' : `Season ${item.season} · Ep ${item.episode}`}
                    </p>
                  </div>
                </button>

                {/* Remove button — appears on hover */}
                <button
                  onClick={(e) => handleRemove(e, item.tmdbId)}
                  title="Remove from Continue Watching"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer z-10"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
