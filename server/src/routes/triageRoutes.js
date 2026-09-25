import { Router } from 'express';
import { assessTriage } from '../controllers/triageController.js';
const r = Router();
r.post('/', assessTriage);
export default r;
