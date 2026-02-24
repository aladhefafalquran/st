import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { MediaCard } from '../components/MediaCard'
import { SkeletonGrid } from '../components/SkeletonCard'
import type { TMDBSearchResult, TMDBPaginatedResponse } from '@streamtime/shared'

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''

  const [input, setInput] = useState(initialQ)
  const [results, setResults] = useState<TMDBSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(initialQ)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce input → fire search + update URL
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = input.trim()
    if (!trimmed) {
      setResults([])
      setSearched('')
      setSearchParams({}, { replace: true })
      return
    }
    debounceRef.current = setTimeout(() => {
      setSearchParams({ q: trimmed }, { replace: true })
      setSearched(trimmed)
      setLoading(true)
      api.get<TMDBPaginatedResponse<TMDBSearchResult>>('/api/tmdb/search', { params: { q: trimmed } })
        .then((r) => setResults(r.data.results.filter((item) => item.media_type !== 'person')))
        .finally(() => setLoading(false))
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [input])

  // If navigated here from Navbar with a fresh ?q=, sync input
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    if (q && q !== input) setInput(q)
  }, [])

  return (
    <div className="pt-20 px-4 sm:px-8 pb-16">
      {/* Search input */}
      <div className="relative max-w-xl mb-8">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--st-text-muted)] pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search movies & TV shows…"
          className="w-full bg-[var(--st-surface)] border border-[var(--st-border)] rounded-xl pl-10 pr-10 py-3 text-white placeholder-[var(--st-text-muted)] focus:outline-none focus:border-[var(--st-accent)] transition-colors"
        />
        {input && (
          <button
            onClick={() => setInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--st-text-muted)] hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Status */}
      {!input.trim() ? (
        <p className="text-[var(--st-text-muted)]">Start typing to search…</p>
      ) : loading ? (
        <SkeletonGrid count={12} />
      ) : results.length === 0 ? (
        <p className="text-[var(--st-text-muted)]">No results for "<span className="text-white">{searched}</span>".</p>
      ) : (
        <>
          <p className="text-[var(--st-text-muted)] text-sm mb-6">
            {results.length} results for "<span className="text-white">{searched}</span>"
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map((item) => {
              const title = item.title ?? item.name ?? 'Untitled'
              const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4)
              return (
                <MediaCard
                  key={item.id}
                  id={item.id}
                  title={title}
                  posterPath={item.poster_path}
                  year={year}
                  mediaType={item.media_type === 'tv' ? 'tv' : 'movie'}
                  voteAverage={item.vote_average}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
