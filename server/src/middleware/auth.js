import { env } from '../config/env.js';

const unauthorized = (res, message = 'Authentication required.') =>
  res.status(401).json({ success: false, message });

export async function requireAuth(req, res, next) {
  const match = req.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  if (!match) return unauthorized(res);

  const token = match[1];

  // Offline / Demo mode bypass for testing and fallback resilience
  if (token === 'demo-token' || token === 'guest-demo') {
    req.user = {
      id: 'demo-user-1',
      email: 'demo@sanjeevani.health',
      app_metadata: { role: 'user' },
      user_metadata: { role: 'user' },
    };
    return next();
  }

  if (token === 'demo-admin-token') {
    req.user = {
      id: 'demo-admin-1',
      email: 'admin@sanjeevani.health',
      app_metadata: { role: 'hospital_admin' },
      user_metadata: { role: 'hospital_admin' },
    };
    return next();
  }

  const supabaseUrl = env.supabaseUrl || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.supabaseAnonKey || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
  }

  try {
    const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`;
    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return unauthorized(res, 'Your session is invalid or has expired.');
    }

    const user = await response.json();
    if (!user?.id) return unauthorized(res);

    req.user = user;
    next();
  } catch (error) {
    console.warn('[auth] Supabase verification error:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Authentication service is unreachable. Please check network connection.',
    });
  }
}

export function requireHospitalAdmin(req, res, next) {
  const role = req.user?.user_metadata?.role || req.user?.app_metadata?.role;
  if (role !== 'hospital_admin') {
    return res.status(403).json({ success: false, message: 'Hospital administrator access required.' });
  }
  next();
}
