import { apiFetch } from './client';
import { WatchlistItem, WatchHistoryItem } from '@streamtime/shared';

export function getWatchlist() {
  return apiFetch<{ items: WatchlistItem[] }>('/api/watchlist');
}

export function addToWatchlist(data: {
  tmdbId: number;
  mediaType: string;
  title: string;
  posterPath?: string | null;
}) {
  return apiFetch<{ item: WatchlistItem }>('/api/watchlist', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function removeFromWatchlist(tmdbId: number, mediaType: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/watchlist?tmdbId=${tmdbId}&mediaType=${mediaType}`,
    { method: 'DELETE' },
  );
}

export function checkWatchlist(tmdbId: number, mediaType: string) {
  return apiFetch<{ inWatchlist: boolean }>(
    `/api/watchlist/check?tmdbId=${tmdbId}&mediaType=${mediaType}`,
  );
}

export function getHistory() {
  return apiFetch<{ items: WatchHistoryItem[] }>('/api/history');
}

export function upsertHistory(data: {
  tmdbId: number;
  mediaType: string;
  title: string;
  posterPath?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  progressSeconds: number;
  durationSeconds: number;
}) {
  return apiFetch<{ item: WatchHistoryItem }>('/api/history', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getProgress(params: {
  tmdbId: number;
  mediaType: string;
  season?: number;
  episode?: number;
}) {
  const url = new URL('/api/history/progress', window.location.origin);
  url.searchParams.set('tmdbId', String(params.tmdbId));
  url.searchParams.set('mediaType', params.mediaType);
  if (params.season !== undefined) url.searchParams.set('season', String(params.season));
  if (params.episode !== undefined) url.searchParams.set('episode', String(params.episode));
  return apiFetch<{ progressSeconds: number; durationSeconds: number }>(url.pathname + url.search);
}
