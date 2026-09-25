import { Router } from 'express';
import { getNearby } from '../controllers/facilityController.js';
const r = Router();
r.get('/nearby', getNearby);
export default r;
