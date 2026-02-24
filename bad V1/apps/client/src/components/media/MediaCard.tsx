import { Link } from 'react-router-dom';
import { imgUrl } from '@/api/tmdb';
import { TMDBMultiResult, TMDBMovie, TMDBTVShow } from '@streamtime/shared';

type MediaItem = TMDBMultiResult | (TMDBMovie & { media_type?: 'movie' }) | (TMDBTVShow & { media_type?: 'tv' });

interface MediaCardProps {
  item: MediaItem;
  mediaType?: 'movie' | 'tv';
}

function getMediaType(item: MediaItem, fallback?: 'movie' | 'tv'): 'movie' | 'tv' {
  if ('media_type' in item && item.media_type) return item.media_type;
  return fallback ?? 'movie';
}

function getTitle(item: MediaItem): string {
  if ('title' in item && item.title) return item.title;
  if ('name' in item && item.name) return item.name;
  return 'Unknown';
}

function getYear(item: MediaItem): string {
  const date =
    ('release_date' in item && item.release_date) ||
    ('first_air_date' in item && item.first_air_date);
  return date ? date.slice(0, 4) : '';
}

export function MediaCard({ item, mediaType }: MediaCardProps) {
  const type = getMediaType(item, mediaType);
  const title = getTitle(item);
  const year = getYear(item);
  const poster = imgUrl(item.poster_path, 'w342');

  return (
    <Link
      to={`/${type}/${item.id}`}
      className="group flex-shrink-0 w-36 sm:w-44 cursor-pointer"
    >
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
        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-white text-xs">{item.vote_average.toFixed(1)}</span>
          </div>
        </div>


      </div>
      <div className="mt-2 px-0.5">
        <p className="text-sm font-medium text-[var(--st-text)] truncate">{title}</p>
        <p className="text-xs text-[var(--st-text-muted)]">{year}</p>
      </div>
    </Link>
  );
}
