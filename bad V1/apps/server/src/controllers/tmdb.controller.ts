import { Request, Response } from 'express';
import * as tmdb from '../services/tmdb.service';

export async function trending(req: Request, res: Response) {
  const { media_type = 'all', time_window = 'week' } = req.query as Record<string, string>;
  const data = await tmdb.getTrending(
    media_type as 'all' | 'movie' | 'tv',
    time_window as 'day' | 'week',
  );
  res.json(data);
}

export async function popularMovies(req: Request, res: Response) {
  const page = Number(req.query.page) || 1;
  res.json(await tmdb.getPopularMovies(page));
}

export async function topRatedMovies(req: Request, res: Response) {
  const page = Number(req.query.page) || 1;
  res.json(await tmdb.getTopRatedMovies(page));
}

export async function popularTV(req: Request, res: Response) {
  const page = Number(req.query.page) || 1;
  res.json(await tmdb.getPopularTV(page));
}

export async function movieDetail(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  res.json(await tmdb.getMovieDetail(id));
}

export async function tvDetail(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  res.json(await tmdb.getTVDetail(id));
}

export async function tvSeason(req: Request, res: Response) {
  const id = Number(req.params.id);
  const season = Number(req.params.season);
  if (!id || !season) { res.status(400).json({ error: 'Invalid params' }); return; }
  res.json(await tmdb.getTVSeason(id, season));
}

export async function search(req: Request, res: Response) {
  const { q, page } = req.query as Record<string, string>;
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }
  res.json(await tmdb.searchMulti(q, Number(page) || 1));
}
