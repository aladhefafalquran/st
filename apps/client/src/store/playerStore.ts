import { create } from 'zustand'

interface PlayerState {
  tmdbId: number | null
  mediaType: 'movie' | 'tv' | null
  title: string | null
  imdbId: string | null
  season: number | null
  episode: number | null
  setMedia: (params: {
    tmdbId: number
    mediaType: 'movie' | 'tv'
    title: string
    imdbId: string
    season?: number
    episode?: number
  }) => void
  clear: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  tmdbId: null,
  mediaType: null,
  title: null,
  imdbId: null,
  season: null,
  episode: null,
  setMedia: (params) =>
    set({
      tmdbId: params.tmdbId,
      mediaType: params.mediaType,
      title: params.title,
      imdbId: params.imdbId,
      season: params.season ?? null,
      episode: params.episode ?? null,
    }),
  clear: () =>
    set({ tmdbId: null, mediaType: null, title: null, imdbId: null, season: null, episode: null }),
}))
