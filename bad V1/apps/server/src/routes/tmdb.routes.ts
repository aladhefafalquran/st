import { Router } from 'express';
import * as ctrl from '../controllers/tmdb.controller';

const router: Router = Router();

router.get('/trending', ctrl.trending);
router.get('/movies/popular', ctrl.popularMovies);
router.get('/movies/top-rated', ctrl.topRatedMovies);
router.get('/tv/popular', ctrl.popularTV);
router.get('/movies/:id', ctrl.movieDetail);
router.get('/tv/:id', ctrl.tvDetail);
router.get('/tv/:id/season/:season', ctrl.tvSeason);
router.get('/search', ctrl.search);

export default router;
