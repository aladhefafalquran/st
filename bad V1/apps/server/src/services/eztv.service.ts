import { TorrentOption } from '@streamtime/shared';

const EZTV_API = 'https://eztv.re/api';

const TRACKERS = [
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:80',
  'udp://tracker.coppersurfer.tk:6969',
  'udp://tracker.opentrackr.org:1337/announce',
];

function buildMagnet(hash: string, title: string): string {
  const trackerParams = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}${trackerParams}`;
}

interface EZTVTorrent {
  id: number;
  hash: string;
  filename: string;
  title: string;
  episode: number;
  season: number;
  seeds: number;
  peers: number;
  size_bytes: string;
  magnet_url: string;
}

const QUALITY_ORDER: Record<string, number> = {
  '2160p': 5,
  '1080p': 4,
  '720p': 3,
  '480p': 2,
  '360p': 1,
};

function detectQuality(filename: string): string {
  for (const q of Object.keys(QUALITY_ORDER)) {
    if (filename.toLowerCase().includes(q)) return q;
  }
  return 'unknown';
}

export async function getTorrentsForEpisode(
  imdbId: string,
  season?: number,
  episode?: number,
): Promise<TorrentOption[]> {
  // EZTV uses numeric imdb ID without leading zeros
  const numericId = parseInt(imdbId.replace(/^tt/, ''), 10).toString();
  const url = `${EZTV_API}/get-torrents?imdb_id=${numericId}&limit=100`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as { torrents?: EZTVTorrent[] };
  let torrents = data?.torrents ?? [];

  if (season !== undefined) {
    torrents = torrents.filter((t) => t.season === season);
  }
  if (episode !== undefined) {
    torrents = torrents.filter((t) => t.episode === episode);
  }

  return torrents
    .map((t): TorrentOption => {
      const quality = detectQuality(t.filename);
      return {
        hash: t.hash,
        magnet: t.magnet_url || buildMagnet(t.hash, t.title),
        quality,
        type: 'web',
        size: `${Math.round(Number(t.size_bytes) / (1024 * 1024))} MB`,
        sizeMB: Math.round(Number(t.size_bytes) / (1024 * 1024)),
        seeds: t.seeds,
        peers: t.peers,
        source: 'eztv',
      };
    })
    .sort((a, b) => {
      const qDiff = (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0);
      return qDiff !== 0 ? qDiff : b.seeds - a.seeds;
    });
}
