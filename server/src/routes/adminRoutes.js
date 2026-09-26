import express from 'express';
import { requireAuth, requireHospitalAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireHospitalAdmin);
router.get('/me', (req, res) => res.json({ success: true, data: { id: req.user.id, email: req.user.email, role: req.user.user_metadata?.role || req.user.app_metadata?.role } }));
export default router;
