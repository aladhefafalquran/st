import { Router } from 'express';
import { register, login, logout, me } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router: Router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

export default router;
