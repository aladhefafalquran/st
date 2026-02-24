import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()

router.use(requireAuth as any)

router.get('/', async (req: AuthRequest, res) => {
  const items = await prisma.watchHistory.findMany({
    where: { userId: req.userId },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(items)
})

router.post('/', async (req: AuthRequest, res) => {
  const { tmdbId, mediaType, title, posterPath, seasonNumber, episodeNumber, progressSeconds, durationSeconds } = req.body
  if (!tmdbId || !mediaType || !title) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  const existing = await prisma.watchHistory.findFirst({
    where: {
      userId: req.userId!,
      tmdbId: Number(tmdbId),
      mediaType,
      seasonNumber: seasonNumber ?? null,
      episodeNumber: episodeNumber ?? null,
    },
  })

  if (existing) {
    const updated = await prisma.watchHistory.update({
      where: { id: existing.id },
      data: {
        progressSeconds: Number(progressSeconds) || 0,
        durationSeconds: Number(durationSeconds) || 0,
        posterPath: posterPath ?? existing.posterPath,
      },
    })
    res.json(updated)
  } else {
    const item = await prisma.watchHistory.create({
      data: {
        userId: req.userId!,
        tmdbId: Number(tmdbId),
        mediaType,
        title,
        posterPath: posterPath ?? null,
        seasonNumber: seasonNumber ?? null,
        episodeNumber: episodeNumber ?? null,
        progressSeconds: Number(progressSeconds) || 0,
        durationSeconds: Number(durationSeconds) || 0,
      },
    })
    res.status(201).json(item)
  }
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params
  await prisma.watchHistory.deleteMany({
    where: { id, userId: req.userId! },
  })
  res.json({ ok: true })
})

router.get('/progress', async (req: AuthRequest, res) => {
  const { tmdbId, mediaType, season, episode } = req.query as Record<string, string>
  if (!tmdbId || !mediaType) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  const item = await prisma.watchHistory.findFirst({
    where: {
      userId: req.userId!,
      tmdbId: Number(tmdbId),
      mediaType,
      seasonNumber: season ? Number(season) : null,
      episodeNumber: episode ? Number(episode) : null,
    },
  })
  res.json(item ?? null)
})

export default router
