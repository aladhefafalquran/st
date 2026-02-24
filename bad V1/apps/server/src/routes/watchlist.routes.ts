import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  checkWatchlist,
} from '../controllers/watchlist.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/', getWatchlist);
router.post('/', addToWatchlist);
router.delete('/', removeFromWatchlist);
router.get('/check', checkWatchlist);

export default router;
