import { Request, Response } from 'express';
import { searchSubtitles, downloadSubtitle } from '../services/subtitle.service';

export async function search(req: Request, res: Response) {
  const { imdb_id, type, languages, season, episode } = req.query as Record<string, string>;

  if (!imdb_id || !type) {
    res.status(400).json({ error: 'imdb_id and type are required' });
    return;
  }

  try {
    const subtitles = await searchSubtitles({
      imdb_id,
      type: type as 'movie' | 'tv',
      languages,
      season: season ? Number(season) : undefined,
      episode: episode ? Number(episode) : undefined,
    });
    res.json({ subtitles });
  } catch (err) {
    console.error('[subtitle] search error:', err);
    res.status(500).json({ error: 'Failed to search subtitles' });
  }
}

export async function download(req: Request, res: Response) {
  const fileId = Number(req.params.fileId);
  if (!fileId) {
    res.status(400).json({ error: 'Invalid fileId' });
    return;
  }

  try {
    const vtt = await downloadSubtitle(fileId);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.send(vtt);
  } catch (err) {
    console.error('[subtitle] download error:', err);
    res.status(500).json({ error: 'Failed to download subtitle' });
  }
}
