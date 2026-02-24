import { Router } from 'express';
import { search, download } from '../controllers/subtitle.controller';

const router: Router = Router();

router.get('/search', search);
router.get('/download/:fileId', download);

export default router;
