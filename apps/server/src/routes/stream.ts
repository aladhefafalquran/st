import { Router, type Request, type Response } from 'express'
import { getVideoFile, startVideoPreload, getTorrentStatus } from '../services/torrent.service.js'
import { getTorrentioStreams } from '../services/torrentio.service.js'
import { env } from '../env.js'

const router: Router = Router()

function getAddonUrls(): string[] {
  return env.STREMIO_ADDONS.split(',').map((u) => u.trim()).filter(Boolean)
}

// GET /api/stream/torrents?imdb_id=&type=&season=&episode=
router.get('/torrents', async (req: Request, res: Response) => {
  const { imdb_id, type, season, episode } = req.query as Record<string, string>

  if (!imdb_id || !type) {
    res.status(400).json({ error: 'imdb_id and type are required' })
    return
  }

  try {
    const torrents = await getTorrentioStreams(
      getAddonUrls(),
      type as 'movie' | 'tv',
      imdb_id,
      season ? Number(season) : undefined,
      episode ? Number(episode) : undefined,
    )
    res.json({ torrents })
  } catch (err) {
    console.error('[stream] getTorrents error:', err)
    res.status(500).json({ error: 'Failed to fetch torrents' })
  }
})

// POST /api/stream/prewarm  body: { magnet, fileIdx? }
router.post('/prewarm', (req: Request, res: Response) => {
  const { magnet, fileIdx } = req.body as { magnet?: string; fileIdx?: number }
  if (!magnet) { res.status(400).json({ error: 'magnet required' }); return }

  startVideoPreload(magnet, fileIdx !== undefined ? Number(fileIdx) : undefined).catch(() => {})
  res.json({ ok: true })
})

// GET /api/stream/status?magnet=&fileIdx=
router.get('/status', (req: Request, res: Response) => {
  const { magnet, fileIdx } = req.query as Record<string, string>
  if (!magnet) { res.status(400).json({ error: 'magnet required' }); return }

  const fileIdxNum = fileIdx !== undefined ? Number(fileIdx) : undefined
  startVideoPreload(magnet, fileIdxNum).catch(() => {})
  res.json(getTorrentStatus(magnet))
})

// GET /api/stream/watch?magnet=&fileIdx=
router.get('/watch', async (req: Request, res: Response) => {
  const { magnet, fileIdx } = req.query as Record<string, string>
  if (!magnet) {
    res.status(400).json({ error: 'magnet is required' })
    return
  }

  const fileIdxNum = fileIdx !== undefined ? Number(fileIdx) : undefined

  let videoInfo: Awaited<ReturnType<typeof getVideoFile>>
  try {
    videoInfo = await getVideoFile(magnet, fileIdxNum)
  } catch (err) {
    console.error('[stream] Failed to get video file:', err)
    res.status(503).json({ error: 'Could not load torrent' })
    return
  }

  const { file, length } = videoInfo
  const rangeHeader = req.headers.range

  const ext = file.name.split('.').pop()?.toLowerCase()
  const contentType =
    ext === 'mp4' ? 'video/mp4'
    : ext === 'mkv' ? 'video/x-matroska'
    : ext === 'webm' ? 'video/webm'
    : 'video/mp4'

  if (!rangeHeader) {
    res.writeHead(200, {
      'Content-Length': length,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    })
    pipeStream(file.createReadStream(), res, req)
    return
  }

  const parts = rangeHeader.replace(/bytes=/, '').split('-')
  const start = parseInt(parts[0], 10)
  const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024 - 1, length - 1)

  if (start >= length || end >= length) {
    res.status(416).setHeader('Content-Range', `bytes */${length}`).end()
    return
  }

  const chunkSize = end - start + 1

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${length}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': contentType,
  })

  pipeStream(file.createReadStream({ start, end }), res, req)
})

function pipeStream(
  readable: NodeJS.ReadableStream,
  res: Response,
  req: Request,
) {
  const cleanup = () => (readable as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.()
  req.on('close', cleanup)
  res.on('close', cleanup)
  readable.on('error', () => {})
  readable.pipe(res as unknown as NodeJS.WritableStream)
}

export default router
