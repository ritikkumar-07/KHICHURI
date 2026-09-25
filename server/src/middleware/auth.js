import { env } from '../config/env.js';

const unauthorized = (res, message = 'Authentication required.') => res.status(401).json({ success: false, message });

export async function requireAuth(req, res, next) {
  const match = req.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  if (!match) return unauthorized(res);
  if (!env.supabaseUrl || !env.supabaseAnonKey) return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: env.supabaseAnonKey, authorization: `Bearer ${match[1]}` } });
    if (!response.ok) return unauthorized(res, 'Your session is invalid or has expired.');
    const user = await response.json();
    if (!user?.id) return unauthorized(res);
    req.user = user;
    next();
  } catch (error) { next(error); }
}

export function requireHospitalAdmin(req, res, next) {
  if (req.user?.app_metadata?.role !== 'hospital_admin') return res.status(403).json({ success: false, message: 'Hospital administrator access required.' });
  next();
}
