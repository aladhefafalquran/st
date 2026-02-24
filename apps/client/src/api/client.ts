import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true,
})

const IMG = import.meta.env.VITE_TMDB_IMAGE_BASE ?? 'https://image.tmdb.org/t/p'

export function tmdbImg(path: string | null | undefined, size = 'w500') {
  if (!path) return null
  return `${IMG}/${size}${path}`
}
