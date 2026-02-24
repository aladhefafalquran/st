import { env } from '../config/env';
import { SubtitleTrack } from '@streamtime/shared';

const OS_BASE = 'https://api.opensubtitles.com/api/v1';

const vttCache = new Map<number, string>();

async function osApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${OS_BASE}${path}`, {
    ...options,
    headers: {
      'Api-Key': env.OPENSUBTITLES_API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'StreamTime v1.0',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenSubtitles error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

interface OSSubtitleFile {
  file_id: number;
  file_name: string;
}

interface OSSubtitle {
  id: string;
  attributes: {
    language: string;
    release: string;
    download_count: number;
    files: OSSubtitleFile[];
  };
}

interface OSSearchResponse {
  data: OSSubtitle[];
}

export async function searchSubtitles(params: {
  imdb_id: string;
  type: 'movie' | 'tv';
  languages?: string;
  season?: number;
  episode?: number;
}): Promise<SubtitleTrack[]> {
  // Build query params without using URL for the path (avoids double /api/v1 in the URL)
  const imdbNumeric = params.imdb_id.replace(/^tt/, '');
  const q = new URLSearchParams({ imdb_id: imdbNumeric });

  if (params.type === 'tv') {
    q.set('type', 'episode');
    if (params.season !== undefined) q.set('season_number', String(params.season));
    if (params.episode !== undefined) q.set('episode_number', String(params.episode));
  } else {
    q.set('type', 'movie');
  }

  if (params.languages) q.set('languages', params.languages);
  q.set('order_by', 'download_count');

  const data = await osApiFetch<OSSearchResponse>(`/subtitles?${q.toString()}`);

  return data.data
    .filter((s) => s.attributes.files.length > 0)
    .map((s): SubtitleTrack => ({
      fileId: s.attributes.files[0].file_id,
      language: s.attributes.language,
      languageCode: s.attributes.language,
      releaseName: s.attributes.release,
      downloadCount: s.attributes.download_count,
    }));
}

function srtToVtt(srt: string): string {
  const vtt = srt
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .replace(/^\d+\s*$/gm, '');

  return `WEBVTT\n\n${vtt.trim()}\n`;
}

interface OSDownloadResponse {
  link: string;
}

export async function downloadSubtitle(fileId: number): Promise<string> {
  if (vttCache.has(fileId)) {
    return vttCache.get(fileId)!;
  }

  const { link } = await osApiFetch<OSDownloadResponse>('/download', {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId, sub_format: 'srt' }),
  });

  const rawRes = await fetch(link);
  if (!rawRes.ok) throw new Error('Failed to download subtitle file');

  const raw = await rawRes.text();
  const vtt = srtToVtt(raw);

  vttCache.set(fileId, vtt);
  return vtt;
}
