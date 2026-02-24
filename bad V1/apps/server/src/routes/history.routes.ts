import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getHistory, upsertHistory, getProgress } from '../controllers/history.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/', getHistory);
router.post('/', upsertHistory);
router.get('/progress', getProgress);

export default router;
