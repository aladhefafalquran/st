import { useNavigate } from 'react-router-dom'
import { tmdbImg } from '../api/client'
import { usePlayerStore } from '../store/playerStore'

interface HeroBannerProps {
  id: number
  title: string
  overview: string
  backdropPath: string | null
  mediaType: 'movie' | 'tv'
  imdbId?: string
}

export function HeroBanner({ id, title, overview, backdropPath, mediaType, imdbId }: HeroBannerProps) {
  const navigate = useNavigate()
  const setMedia = usePlayerStore((s) => s.setMedia)
  const backdrop = tmdbImg(backdropPath, 'original')

  function handleWatch() {
    if (!imdbId) {
      navigate(mediaType === 'movie' ? `/movie/${id}` : `/tv/${id}`)
      return
    }
    setMedia({ tmdbId: id, mediaType, title, imdbId })
    navigate('/watch')
  }

  return (
    <div className="relative w-full h-[70vh] min-h-[400px] overflow-hidden">
      {backdrop && (
        <img src={backdrop} alt={title} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--st-bg)] via-[var(--st-bg)]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-transparent to-transparent" />

      <div className="absolute bottom-8 sm:bottom-16 left-8 sm:left-16 right-8 sm:right-auto max-w-xl">
        <h1 className="text-2xl sm:text-5xl font-bold text-white mb-2 sm:mb-3 drop-shadow-lg leading-tight">{title}</h1>
        <p className="text-sm sm:text-base text-[var(--st-text-muted)] mb-4 sm:mb-6 line-clamp-2 sm:line-clamp-3 max-w-md">
          {overview}
        </p>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={handleWatch}
            className="inline-flex items-center gap-2 bg-white text-black px-4 py-2.5 sm:px-6 sm:py-3 rounded-md font-semibold hover:bg-white/90 transition-colors text-sm"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch Now
          </button>
          <button
            onClick={() => navigate(mediaType === 'movie' ? `/movie/${id}` : `/tv/${id}`)}
            className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-md font-semibold hover:bg-white/30 transition-colors text-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            More Info
          </button>
        </div>
      </div>
    </div>
  )
}
