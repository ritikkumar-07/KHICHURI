import { Router } from 'express';
import { postSos, getSos } from '../controllers/sosController.js';
const r = Router();
r.post('/', postSos);
r.get('/:id', getSos);
export default r;
