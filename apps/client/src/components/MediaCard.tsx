import { Link } from 'react-router-dom'
import { tmdbImg } from '../api/client'

interface MediaCardProps {
  id: number
  title: string
  posterPath: string | null
  year?: string
  mediaType: 'movie' | 'tv'
  voteAverage?: number
}

export function MediaCard({ id, title, posterPath, year, mediaType, voteAverage }: MediaCardProps) {
  const href = `/${mediaType}/${id}`
  const poster = tmdbImg(posterPath, 'w342')

  return (
    <Link to={href} className="group flex-shrink-0 w-36 sm:w-44 cursor-pointer">
      <div className="relative overflow-hidden rounded-lg bg-[var(--st-surface-2)] aspect-[2/3]">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--st-text-muted)] text-xs text-center p-2">
            {title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {voteAverage !== undefined && voteAverage > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 rounded px-1 py-0.5 flex items-center gap-0.5">
            <span className="text-yellow-400 text-[10px]">★</span>
            <span className="text-white text-[10px] font-medium">{voteAverage.toFixed(1)}</span>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-sm font-medium text-[var(--st-text)] truncate">{title}</p>
        {year && <p className="text-xs text-[var(--st-text-muted)]">{year}</p>}
      </div>
    </Link>
  )
}
