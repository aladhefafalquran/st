export interface WatchlistItem {
  id: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  addedAt: string
}

export interface WatchHistoryItem {
  id: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  progressSeconds: number
  durationSeconds: number
  updatedAt: string
}
