import { TorrentOption } from '@streamtime/shared';

// HTTP/HTTPS only — UDP trackers caused peer discovery failures on Windows.
// WebTorrent on Windows cannot reliably open UDP sockets for tracker announces
// in some environments; HTTP/HTTPS announces work over standard TCP.
const TRACKERS = [
  // HTTPS — encrypted TCP
  'https://opentracker.i2p.rocks:443/announce',
  'https://tracker.tamersunion.org:443/announce',
  'https://tracker.gbitt.info:443/announce',
  // HTTP — plain TCP, broad compatibility
  'http://tracker.opentrackr.org:1337/announce',
  'http://open.tracker.cl:1337/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'http://tracker.torrent.eu.org:451/announce',
  'http://open.demonii.com:1337/announce',
  'http://tracker.moeking.me:6969/announce',
  'http://tracker.tiny-vps.com:6969/announce',
  'http://exodus.desync.com:6969/announce',
  'http://tracker1.bt.moack.co.kr:80/announce',
];

function buildMagnet(hash: string, title: string): string {
  const trackers = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}${trackers}`;
}

interface TorrentioStream {
  name: string;
  title: string;
  infoHash: string;
  fileIdx?: number;
  behaviorHints?: { videoSize?: number; bingeGroup?: string; filename?: string };
}

const QUALITY_ORDER: Record<string, number> = {
  '2160p': 5,
  '1080p': 4,
  '720p': 3,
  '480p': 2,
  '360p': 1,
};

function parseQuality(name: string): string {
  const line = name.split('\n')[1] ?? name;
  if (/4k|2160/i.test(line)) return '2160p';
  if (/1080p/i.test(line)) return '1080p';
  if (/720p/i.test(line)) return '720p';
  if (/480p/i.test(line)) return '480p';
  if (/360p/i.test(line)) return '360p';
  return line.trim() || 'unknown';
}

function parseSeeds(title: string): number {
  const match = title.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseSize(
  title: string,
  behaviorHints?: { videoSize?: number },
): { sizeStr: string; sizeMB: number } {
  if (behaviorHints?.videoSize) {
    const mb = Math.round(behaviorHints.videoSize / (1024 * 1024));
    const sizeStr = mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
    return { sizeStr, sizeMB: mb };
  }
  const match = title.match(/💾\s*([\d.]+)\s*(GB|MB)/i);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const mb = unit === 'GB' ? Math.round(val * 1024) : Math.round(val);
    return { sizeStr: `${match[1]} ${match[2]}`, sizeMB: mb };
  }
  return { sizeStr: 'unknown', sizeMB: 0 };
}

/**
 * Fetch streams from a single Stremio addon base URL.
 * Any Stremio-protocol addon works here (Torrentio, MediaFusion, custom addons, etc.)
 */
export async function fetchAddonStreams(
  baseUrl: string,
  type: 'movie' | 'tv',
  imdbId: string,
  season?: number,
  episode?: number,
): Promise<TorrentOption[]> {
  const stremioType = type === 'tv' ? 'series' : 'movie';
  const streamId = type === 'tv' ? `${imdbId}:${season}:${episode}` : imdbId;
  const url = `${baseUrl.replace(/\/$/, '')}/stream/${stremioType}/${streamId}.json`;

  console.log(`[addon] Fetching: ${url}`);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.warn(`[addon] Fetch failed for ${baseUrl}: ${err}`);
    return [];
  }

  if (!res.ok) {
    console.warn(`[addon] HTTP ${res.status} for ${url}`);
    return [];
  }

  const data = (await res.json()) as { streams?: TorrentioStream[] };
  const streams = data.streams ?? [];

  console.log(`[addon] Got ${streams.length} streams from ${baseUrl} for ${streamId}`);

  return streams
    .filter((s) => s.infoHash)
    .map((s): TorrentOption => {
      const quality = parseQuality(s.name);
      const seeds = parseSeeds(s.title);
      const { sizeStr, sizeMB } = parseSize(s.title, s.behaviorHints);
      const titleLine = s.title.split('\n')[0] ?? s.title;

      return {
        hash: s.infoHash,
        magnet: buildMagnet(s.infoHash, titleLine),
        quality,
        type: 'web',
        size: sizeStr,
        sizeMB,
        seeds,
        peers: 0,
        source: 'torrentio',
        fileIdx: s.fileIdx,
        filename: s.behaviorHints?.filename,
      };
    });
}

/**
 * Query all configured addon URLs in parallel, merge, deduplicate by hash,
 * then sort by quality then seeds.
 */
export async function getTorrentioStreams(
  addonUrls: string[],
  type: 'movie' | 'tv',
  imdbId: string,
  season?: number,
  episode?: number,
): Promise<TorrentOption[]> {
  const results = await Promise.allSettled(
    addonUrls.map((url) => fetchAddonStreams(url, type, imdbId, season, episode)),
  );

  const all: TorrentOption[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const t of r.value) {
      if (!seen.has(t.hash)) {
        seen.add(t.hash);
        all.push(t);
      }
    }
  }

  return all.sort((a, b) => {
    const qDiff = (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0);
    return qDiff !== 0 ? qDiff : b.seeds - a.seeds;
  });
}
