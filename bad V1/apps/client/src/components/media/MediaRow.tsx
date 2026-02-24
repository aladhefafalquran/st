import { useRef } from 'react';
import { MediaCard } from './MediaCard';
import { TMDBMultiResult } from '@streamtime/shared';

interface MediaRowProps {
  title: string;
  items: TMDBMultiResult[];
  mediaType?: 'movie' | 'tv';
}

export function MediaRow({ title, items, mediaType }: MediaRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 'left' | 'right') {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir === 'right' ? 400 : -400, behavior: 'smooth' });
  }

  if (!items.length) return null;

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
        <div
          ref={rowRef}
          className="flex gap-3 overflow-x-auto hide-scrollbar px-4 sm:px-8 pb-2"
        >
          {items.map((item) => (
            <MediaCard key={`${item.id}-${item.media_type}`} item={item} mediaType={mediaType} />
          ))}
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
  );
}
