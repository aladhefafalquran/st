import { Router } from 'express';
import { streamVideo, getTorrents, prewarmTorrent, streamStatus } from '../controllers/stream.controller';

const router: Router = Router();

router.get('/watch', streamVideo);
router.get('/torrents', getTorrents);
router.get('/status', streamStatus);
router.post('/prewarm', prewarmTorrent);

export default router;
