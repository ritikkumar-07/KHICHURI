import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { postSos, getSos } from '../controllers/sosController.js';

const router = Router();

router.post('/', optionalAuth, postSos);
router.get('/:id', optionalAuth, getSos);

export default router;
