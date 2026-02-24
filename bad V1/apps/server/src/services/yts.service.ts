import { TorrentOption } from '@streamtime/shared';

const YTS_API = 'https://yts.mx/api/v2';

const TRACKERS = [
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:80',
  'udp://tracker.coppersurfer.tk:6969',
  'udp://glotorrents.pw:6969/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://torrent.gresille.org:80/announce',
  'udp://p4p.arenabg.com:1337',
  'udp://tracker.leechers-paradise.org:6969',
];

function buildMagnet(hash: string, title: string): string {
  const trackerParams = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}${trackerParams}`;
}

interface YTSTorrent {
  hash: string;
  quality: string;
  type: string;
  size: string;
  size_bytes: number;
  seeds: number;
  peers: number;
}

interface YTSMovie {
  id: number;
  imdb_code: string;
  title: string;
  torrents: YTSTorrent[];
}

export async function getTorrentsForMovie(imdbId: string): Promise<TorrentOption[]> {
  const url = `${YTS_API}/list_movies.json?query_term=${imdbId}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    data?: { movies?: YTSMovie[] };
  };

  const movies = data?.data?.movies;
  if (!movies || movies.length === 0) return [];

  const movie = movies.find((m) => m.imdb_code === imdbId) ?? movies[0];
  if (!movie?.torrents) return [];

  return movie.torrents
    .map((t): TorrentOption => ({
      hash: t.hash,
      magnet: buildMagnet(t.hash, movie.title),
      quality: t.quality,
      type: t.type,
      size: t.size,
      sizeMB: Math.round(t.size_bytes / (1024 * 1024)),
      seeds: t.seeds,
      peers: t.peers,
      source: 'yts',
    }))
    .sort((a, b) => b.seeds - a.seeds);
}
