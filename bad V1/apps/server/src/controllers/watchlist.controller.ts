import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

export async function getWatchlist(req: AuthRequest, res: Response) {
  const items = await prisma.watchlist.findMany({
    where: { userId: req.userId! },
    orderBy: { addedAt: 'desc' },
  });
  res.json({ items });
}

export async function addToWatchlist(req: AuthRequest, res: Response) {
  const { tmdbId, mediaType, title, posterPath } = req.body as {
    tmdbId: number;
    mediaType: string;
    title: string;
    posterPath?: string;
  };

  if (!tmdbId || !mediaType || !title) {
    res.status(400).json({ error: 'tmdbId, mediaType, and title are required' });
    return;
  }

  const item = await prisma.watchlist.upsert({
    where: {
      userId_tmdbId_mediaType: {
        userId: req.userId!,
        tmdbId,
        mediaType,
      },
    },
    create: { userId: req.userId!, tmdbId, mediaType, title, posterPath },
    update: { title, posterPath },
  });

  res.status(201).json({ item });
}

export async function removeFromWatchlist(req: AuthRequest, res: Response) {
  const { tmdbId, mediaType } = req.query as { tmdbId: string; mediaType: string };

  if (!tmdbId || !mediaType) {
    res.status(400).json({ error: 'tmdbId and mediaType are required' });
    return;
  }

  await prisma.watchlist.deleteMany({
    where: {
      userId: req.userId!,
      tmdbId: Number(tmdbId),
      mediaType,
    },
  });

  res.json({ ok: true });
}

export async function checkWatchlist(req: AuthRequest, res: Response) {
  const { tmdbId, mediaType } = req.query as { tmdbId: string; mediaType: string };

  const item = await prisma.watchlist.findFirst({
    where: {
      userId: req.userId!,
      tmdbId: Number(tmdbId),
      mediaType,
    },
  });

  res.json({ inWatchlist: !!item });
}
