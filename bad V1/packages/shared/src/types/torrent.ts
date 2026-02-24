export interface TorrentOption {
  hash: string;
  magnet: string;
  quality: string;
  type: string;
  size: string;
  sizeMB: number;
  seeds: number;
  peers: number;
  source: 'yts' | 'eztv' | 'torrentio';
  fileIdx?: number;
  /** Filename hint from Torrentio — used to skip browser WebTorrent for MKV/AVI */
  filename?: string;
}

export interface TorrentSearchParams {
  imdb_id: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}
