import { Request, Response } from 'express';
import { getVideoFile, startVideoPreload, getTorrentStatus } from '../services/torrent.service';
import { getTorrentioStreams } from '../services/torrentio.service';
import { env } from '../config/env';

const getAddonUrls = () =>
  env.STREMIO_ADDONS.split(',')
    .map((u) => u.trim())
    .filter(Boolean);

export async function streamVideo(req: Request, res: Response) {
  const { magnet, fileIdx } = req.query as { magnet: string; fileIdx?: string };
  if (!magnet) {
    res.status(400).json({ error: 'magnet is required' });
    return;
  }

  const fileIdxNum = fileIdx !== undefined ? Number(fileIdx) : undefined;

  let videoInfo: Awaited<ReturnType<typeof getVideoFile>>;
  try {
    videoInfo = await getVideoFile(magnet, fileIdxNum);
  } catch (err) {
    console.error('[stream] Failed to get video file:', err);
    res.status(503).json({ error: 'Could not load torrent, try again' });
    return;
  }

  const { file, length } = videoInfo;
  const rangeHeader = req.headers.range;

  const ext = file.name.split('.').pop()?.toLowerCase();
  const contentType =
    ext === 'mp4'
      ? 'video/mp4'
      : ext === 'mkv'
        ? 'video/x-matroska'
        : ext === 'webm'
          ? 'video/webm'
          : 'video/mp4';

  if (!rangeHeader) {
    res.writeHead(200, {
      'Content-Length': length,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    pipeStream(file.createReadStream(), res, req);
    return;
  }

  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024 - 1, length - 1);

  if (start >= length || end >= length) {
    res.status(416).setHeader('Content-Range', `bytes */${length}`).end();
    return;
  }

  const chunkSize = end - start + 1;

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${length}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': contentType,
  });

  pipeStream(file.createReadStream({ start, end }), res, req);
}

/**
 * Safely pipe a WebTorrent read stream to an HTTP response.
 * Destroys the read stream when the client disconnects to prevent the
 * "Writable stream closed prematurely" unhandled error from crashing the server.
 */
function pipeStream(
  readable: NodeJS.ReadableStream,
  res: import('express').Response,
  req: import('express').Request,
) {
  // When browser seeks/navigates away the socket closes — destroy the source stream
  const cleanup = () => (readable as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
  req.on('close', cleanup);
  res.on('close', cleanup);

  // Swallow streamx's "Writable stream closed prematurely" — it's just a client disconnect
  readable.on('error', () => {});

  readable.pipe(res);
}

/**
 * POST /api/stream/prewarm  { magnet }
 * Starts loading the torrent in the background immediately after the user
 * clicks a quality button — so peer discovery is already underway by the
 * time the video player makes its first range request.
 */
export function prewarmTorrent(req: Request, res: Response) {
  const { magnet, fileIdx } = req.body as { magnet?: string; fileIdx?: number };
  if (!magnet) { res.status(400).json({ error: 'magnet required' }); return; }

  // Fire and forget — loads torrent metadata then pre-downloads first 12 MB
  // of video bytes into WebTorrent's piece cache so the first range request
  // from the browser is served from disk instead of waiting for peer transfer.
  startVideoPreload(magnet, fileIdx !== undefined ? Number(fileIdx) : undefined).catch(() => {});

  res.json({ ok: true });
}

/**
 * GET /api/stream/status?magnet=&fileIdx=
 * Returns current torrent loading phase so the client can show a progress UI
 * instead of a blank spinner. Also fires startVideoPreload (idempotent) so the
 * server is always pre-downloading bytes while the user is on the loading screen.
 */
export function streamStatus(req: Request, res: Response) {
  const { magnet, fileIdx } = req.query as { magnet?: string; fileIdx?: string };
  if (!magnet) { res.status(400).json({ error: 'magnet required' }); return; }

  const fileIdxNum = fileIdx !== undefined ? Number(fileIdx) : undefined;
  startVideoPreload(magnet, fileIdxNum).catch(() => {}); // idempotent fire-and-forget
  res.json(getTorrentStatus(magnet));
}

export async function getTorrents(req: Request, res: Response) {
  const { imdb_id, type, season, episode } = req.query as {
    imdb_id: string;
    type: string;
    season?: string;
    episode?: string;
  };

  if (!imdb_id || !type) {
    res.status(400).json({ error: 'imdb_id and type are required' });
    return;
  }

  try {
    const torrents = await getTorrentioStreams(
      getAddonUrls(),
      type as 'movie' | 'tv',
      imdb_id,
      season ? Number(season) : undefined,
      episode ? Number(episode) : undefined,
    );
    res.json({ torrents });
  } catch (err) {
    console.error('[stream] getTorrents error:', err);
    res.status(500).json({ error: 'Failed to fetch torrents' });
  }
}
