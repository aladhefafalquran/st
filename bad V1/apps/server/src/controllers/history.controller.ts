import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

export async function getHistory(req: AuthRequest, res: Response) {
  const items = await prisma.watchHistory.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  res.json({ items });
}

export async function upsertHistory(req: AuthRequest, res: Response) {
  const {
    tmdbId,
    mediaType,
    title,
    posterPath,
    seasonNumber,
    episodeNumber,
    progressSeconds,
    durationSeconds,
  } = req.body as {
    tmdbId: number;
    mediaType: string;
    title: string;
    posterPath?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    progressSeconds: number;
    durationSeconds: number;
  };

  if (!tmdbId || !mediaType || !title) {
    res.status(400).json({ error: 'tmdbId, mediaType, and title are required' });
    return;
  }

  // findFirst + create/update avoids Prisma's compound nullable unique limitation
  const existing = await prisma.watchHistory.findFirst({
    where: {
      userId: req.userId!,
      tmdbId,
      mediaType,
      seasonNumber: seasonNumber ?? null,
      episodeNumber: episodeNumber ?? null,
    },
  });

  const item = existing
    ? await prisma.watchHistory.update({
        where: { id: existing.id },
        data: {
          progressSeconds: progressSeconds ?? 0,
          durationSeconds: durationSeconds ?? 0,
          title,
          posterPath,
        },
      })
    : await prisma.watchHistory.create({
        data: {
          userId: req.userId!,
          tmdbId,
          mediaType,
          title,
          posterPath,
          seasonNumber: seasonNumber ?? null,
          episodeNumber: episodeNumber ?? null,
          progressSeconds: progressSeconds ?? 0,
          durationSeconds: durationSeconds ?? 0,
        },
      });

  res.json({ item });
}

export async function getProgress(req: AuthRequest, res: Response) {
  const { tmdbId, mediaType, season, episode } = req.query as Record<string, string>;

  const item = await prisma.watchHistory.findFirst({
    where: {
      userId: req.userId!,
      tmdbId: Number(tmdbId),
      mediaType,
      seasonNumber: season ? Number(season) : null,
      episodeNumber: episode ? Number(episode) : null,
    },
  });

  res.json({ progressSeconds: item?.progressSeconds ?? 0, durationSeconds: item?.durationSeconds ?? 0 });
}
