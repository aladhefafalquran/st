import { Link } from 'react-router-dom';
import { imgUrl } from '@/api/tmdb';
import { TMDBMultiResult } from '@streamtime/shared';

interface HeroBannerProps {
  item: TMDBMultiResult;
}

function getTitle(item: TMDBMultiResult) {
  return ('title' in item && item.title) || ('name' in item && item.name) || 'Unknown';
}

export function HeroBanner({ item }: HeroBannerProps) {
  const title = getTitle(item);
  const backdrop = imgUrl(item.backdrop_path, 'original');
  const type = item.media_type ?? 'movie';

  return (
    <div className="relative w-full h-[70vh] min-h-[400px] overflow-hidden">
      {backdrop && (
        <img
          src={backdrop}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--st-bg)] via-[var(--st-bg)]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-transparent to-transparent" />

      <div className="absolute bottom-16 left-8 sm:left-16 max-w-xl">
        <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 drop-shadow-lg">{title}</h1>
        <p className="text-sm sm:text-base text-[var(--st-text-muted)] mb-6 line-clamp-3 max-w-md">
          {item.overview}
        </p>
        <div className="flex gap-3">
          <Link
            to={`/${type}/${item.id}`}
            className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-md font-semibold hover:bg-white/90 transition-colors text-sm"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            More Info
          </Link>
          <Link
            to={`/${type}/${item.id}`}
            className="inline-flex items-center gap-2 bg-white/20 text-white px-6 py-3 rounded-md font-semibold hover:bg-white/30 transition-colors text-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
