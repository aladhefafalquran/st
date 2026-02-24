import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()

router.use(requireAuth as any)

router.get('/', async (req: AuthRequest, res) => {
  const items = await prisma.watchlist.findMany({
    where: { userId: req.userId },
    orderBy: { addedAt: 'desc' },
  })
  res.json(items)
})

router.post('/', async (req: AuthRequest, res) => {
  const { tmdbId, mediaType, title, posterPath } = req.body
  if (!tmdbId || !mediaType || !title) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  const existing = await prisma.watchlist.findFirst({
    where: { userId: req.userId!, tmdbId: Number(tmdbId), mediaType },
  })
  if (existing) {
    res.json(existing)
    return
  }

  const item = await prisma.watchlist.create({
    data: {
      userId: req.userId!,
      tmdbId: Number(tmdbId),
      mediaType,
      title,
      posterPath: posterPath ?? null,
    },
  })
  res.status(201).json(item)
})

router.delete('/', async (req: AuthRequest, res) => {
  const { tmdbId, mediaType } = req.body
  if (!tmdbId || !mediaType) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  await prisma.watchlist.deleteMany({
    where: { userId: req.userId!, tmdbId: Number(tmdbId), mediaType },
  })
  res.json({ ok: true })
})

router.get('/check', async (req: AuthRequest, res) => {
  const { tmdbId, mediaType } = req.query as Record<string, string>
  if (!tmdbId || !mediaType) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  const item = await prisma.watchlist.findFirst({
    where: { userId: req.userId!, tmdbId: Number(tmdbId), mediaType },
  })
  res.json({ inWatchlist: !!item })
})

export default router
