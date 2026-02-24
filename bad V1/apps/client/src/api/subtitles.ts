import { apiFetch } from './client';
import { SubtitleTrack } from '@streamtime/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function searchSubtitles(params: {
  imdb_id: string;
  type: 'movie' | 'tv';
  languages?: string;
  season?: number;
  episode?: number;
}) {
  const url = new URL(`${API_BASE}/api/subtitles/search`);
  url.searchParams.set('imdb_id', params.imdb_id);
  url.searchParams.set('type', params.type);
  if (params.languages) url.searchParams.set('languages', params.languages);
  if (params.season !== undefined) url.searchParams.set('season', String(params.season));
  if (params.episode !== undefined) url.searchParams.set('episode', String(params.episode));
  return apiFetch<{ subtitles: SubtitleTrack[] }>(url.pathname + url.search);
}

export function getSubtitleUrl(fileId: number): string {
  return `${API_BASE}/api/subtitles/download/${fileId}`;
}
