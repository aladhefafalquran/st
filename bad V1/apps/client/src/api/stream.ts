import { apiFetch } from './client';
import { TorrentOption } from '@streamtime/shared';

export interface StreamStatus {
  phase: 'waiting' | 'connecting' | 'ready';
  peers: number;
  downloadSpeed: number;
  preloadDone: boolean;
  preloadBytes: number;
  preloadTotal: number;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function getTorrents(params: {
  imdb_id: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}) {
  const url = new URL(`${API_BASE}/api/stream/torrents`);
  url.searchParams.set('imdb_id', params.imdb_id);
  url.searchParams.set('type', params.type);
  if (params.season !== undefined) url.searchParams.set('season', String(params.season));
  if (params.episode !== undefined) url.searchParams.set('episode', String(params.episode));
  return apiFetch<{ torrents: TorrentOption[] }>(url.pathname + url.search);
}

export function getStreamUrl(magnet: string, fileIdx?: number | null): string {
  let url = `${API_BASE}/api/stream/watch?magnet=${encodeURIComponent(magnet)}`;
  if (fileIdx !== undefined && fileIdx !== null) url += `&fileIdx=${fileIdx}`;
  return url;
}

/**
 * Fire-and-forget: tells the server to start peer discovery + metadata download
 * immediately when the user clicks a quality button, before they even reach /watch.
 * By the time the video player makes its first range request, WebTorrent already
 * has peers connected and the torrent metadata downloaded.
 */
export async function checkStreamStatus(magnet: string, fileIdx?: number | null): Promise<StreamStatus> {
  let url = `${API_BASE}/api/stream/status?magnet=${encodeURIComponent(magnet)}`;
  if (fileIdx != null) url += `&fileIdx=${fileIdx}`;
  const res = await fetch(url, { credentials: 'include' });
  return res.json() as Promise<StreamStatus>;
}

export function prewarm(magnet: string, fileIdx?: number | null): void {
  fetch(`${API_BASE}/api/stream/prewarm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ magnet, ...(fileIdx != null ? { fileIdx } : {}) }),
  }).catch(() => {}); // intentionally fire and forget
}
