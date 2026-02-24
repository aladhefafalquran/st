import { env } from '../config/env';
import {
  TMDBMovie,
  TMDBTVShow,
  TMDBPageResult,
  TMDBMultiResult,
  TMDBSeason,
  TMDBEpisode,
} from '@streamtime/shared';

const BASE = 'https://api.themoviedb.org/3';

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.TMDB_API_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`TMDB error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function getTrending(
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  timeWindow: 'day' | 'week' = 'week',
): Promise<TMDBPageResult<TMDBMultiResult>> {
  return tmdbFetch(`/trending/${mediaType}/${timeWindow}`);
}

export async function getPopularMovies(page = 1): Promise<TMDBPageResult<TMDBMovie>> {
  return tmdbFetch('/movie/popular', { page: String(page) });
}

export async function getTopRatedMovies(page = 1): Promise<TMDBPageResult<TMDBMovie>> {
  return tmdbFetch('/movie/top_rated', { page: String(page) });
}

export async function getPopularTV(page = 1): Promise<TMDBPageResult<TMDBTVShow>> {
  return tmdbFetch('/tv/popular', { page: String(page) });
}

export async function getMovieDetail(id: number): Promise<TMDBMovie> {
  return tmdbFetch(`/movie/${id}`, {
    append_to_response: 'videos,credits,external_ids',
  });
}

export async function getTVDetail(id: number): Promise<TMDBTVShow> {
  return tmdbFetch(`/tv/${id}`, {
    append_to_response: 'videos,credits,external_ids',
  });
}

export async function getTVSeason(tvId: number, seasonNumber: number): Promise<{ episodes: TMDBEpisode[] }> {
  return tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`);
}

export async function searchMulti(query: string, page = 1): Promise<TMDBPageResult<TMDBMultiResult>> {
  return tmdbFetch('/search/multi', { query, page: String(page) });
}

export async function getMoviesByGenre(genreId: number, page = 1): Promise<TMDBPageResult<TMDBMovie>> {
  return tmdbFetch('/discover/movie', {
    with_genres: String(genreId),
    page: String(page),
    sort_by: 'popularity.desc',
  });
}
