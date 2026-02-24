const KEY = 'st_continue_watching'

export interface ContinueWatchingItem {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  imdbId: string
  season?: number
  episode?: number
  updatedAt: number
}

export function saveContinueWatching(item: Omit<ContinueWatchingItem, 'updatedAt'>) {
  const list = getContinueWatching().filter((i) => i.tmdbId !== item.tmdbId)
  list.unshift({ ...item, updatedAt: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)))
}

export function removeContinueWatching(tmdbId: number) {
  const list = getContinueWatching().filter((i) => i.tmdbId !== tmdbId)
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function getContinueWatching(): ContinueWatchingItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
