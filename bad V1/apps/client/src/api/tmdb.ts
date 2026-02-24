import { apiFetch } from './client';
import {
  TMDBMovie,
  TMDBTVShow,
  TMDBPageResult,
  TMDBMultiResult,
  TMDBEpisode,
} from '@streamtime/shared';

export const TMDB_IMG = import.meta.env.VITE_TMDB_IMAGE_BASE ?? 'https://image.tmdb.org/t/p';

export function imgUrl(path: string | null | undefined, size = 'w342') {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}

export function getTrending(mediaType = 'all', timeWindow = 'week') {
  return apiFetch<TMDBPageResult<TMDBMultiResult>>(
    `/api/tmdb/trending?media_type=${mediaType}&time_window=${timeWindow}`,
  );
}

export function getPopularMovies(page = 1) {
  return apiFetch<TMDBPageResult<TMDBMovie>>(`/api/tmdb/movies/popular?page=${page}`);
}

export function getTopRatedMovies(page = 1) {
  return apiFetch<TMDBPageResult<TMDBMovie>>(`/api/tmdb/movies/top-rated?page=${page}`);
}

export function getPopularTV(page = 1) {
  return apiFetch<TMDBPageResult<TMDBTVShow>>(`/api/tmdb/tv/popular?page=${page}`);
}

export function getMovieDetail(id: number) {
  return apiFetch<TMDBMovie>(`/api/tmdb/movies/${id}`);
}

export function getTVDetail(id: number) {
  return apiFetch<TMDBTVShow>(`/api/tmdb/tv/${id}`);
}

export function getTVSeason(tvId: number, season: number) {
  return apiFetch<{ episodes: TMDBEpisode[] }>(`/api/tmdb/tv/${tvId}/season/${season}`);
}

export function searchMulti(q: string, page = 1) {
  return apiFetch<TMDBPageResult<TMDBMultiResult>>(
    `/api/tmdb/search?q=${encodeURIComponent(q)}&page=${page}`,
  );
}
