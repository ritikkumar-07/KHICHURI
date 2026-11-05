import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { isSupabaseConfigured } from '../config/supabase.js';

const DEMO_USERS = new Map([
  [
    'demo-token',
    {
      id: 'demo-user-1',
      email: 'demo@sanjeevani.health',
      app_metadata: { role: 'user' },
    },
  ],
  [
    'guest-demo',
    {
      id: 'demo-user-1',
      email: 'demo@sanjeevani.health',
      app_metadata: { role: 'user' },
    },
  ],
  [
    'demo-admin-token',
    {
      id: 'demo-admin-1',
      email: 'admin@sanjeevani.health',
      app_metadata: { role: 'hospital_admin' },
    },
  ],
]);

const authError = (message, code, status = 401) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

/**
 * Demo credentials are only accepted for local/demo use. A production
 * deployment must explicitly opt in with ALLOW_DEMO_AUTH=true.
 */
export function isDemoAuthEnabled() {
  if (env.allowDemoAuth) return true;
  return !env.isProduction && !isSupabaseConfigured;
}

export function getBearerToken(req) {
  const match = req.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function getUserRole(user) {
  // Only app_metadata is server-controlled in Supabase. user_metadata can be
  // written by the signed-in user and must never grant privileges.
  return user?.app_metadata?.role || null;
}

export function isHospitalAdmin(user) {
  return getUserRole(user) === 'hospital_admin';
}

export async function verifySupabaseAccessToken(token) {
  if (!env.supabaseUrl || !env.supabaseAnonKey || !isSupabaseConfigured) {
    throw authError(
      'Authentication is not configured.',
      'AUTH_NOT_CONFIGURED',
      503
    );
  }

  let response;
  try {
    response = await fetch(
      `${env.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`,
      {
        headers: {
          apikey: env.supabaseAnonKey,
          authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
  } catch (error) {
    throw authError(
      'Authentication service is unreachable.',
      'AUTH_UNAVAILABLE',
      503
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw authError(
      'Your session is invalid or has expired.',
      'INVALID_TOKEN',
      401
    );
  }

  if (!response.ok) {
    throw authError(
      'Authentication service is unreachable.',
      'AUTH_UNAVAILABLE',
      503
    );
  }

  const user = await response.json().catch(() => null);
  if (!user?.id) {
    throw authError('Your session is invalid or has expired.', 'INVALID_TOKEN');
  }

  return user;
}

export async function resolveUserFromToken(token) {
  if (!token) return null;

  if (isDemoAuthEnabled()) {
    const demoUser = DEMO_USERS.get(token);
    if (demoUser) return demoUser;
  }

  return verifySupabaseAccessToken(token);
}

export async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: 'Authentication required.' });
  }

  try {
    req.user = await resolveUserFromToken(token);
    return next();
  } catch (error) {
    if (error.code === 'AUTH_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        message: 'Authentication is not configured.',
      });
    }
    if (error.code === 'AUTH_UNAVAILABLE') {
      console.warn('[auth] Supabase verification unavailable:', error.message);
      return res.status(503).json({
        success: false,
        message:
          'Authentication service is unreachable. Please check network connection.',
      });
    }
    return res
      .status(401)
      .json({ success: false, message: 'Your session is invalid or has expired.' });
  }
}

/**
 * Used by emergency creation so an unauthenticated caller can still request
 * help, while a signed-in caller's alert is bound to their account.
 */
export async function optionalAuth(req, _res, next) {
  const token = getBearerToken(req);
  if (!token) return next();

  try {
    req.user = await resolveUserFromToken(token);
  } catch (error) {
    if (error.code === 'AUTH_UNAVAILABLE') {
      console.warn('[auth] Optional authentication unavailable:', error.message);
    }
  }

  return next();
}

export function requireHospitalAdmin(req, res, next) {
  if (!isHospitalAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Hospital administrator access required.',
    });
  }
  return next();
}

const tokensMatch = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export function canAccessSosAlert(alert, user, accessToken = null) {
  if (!alert) return false;
  if (user && isHospitalAdmin(user)) return true;
  if (alert.ownerId && user?.id === alert.ownerId) return true;
  if (!alert.ownerId) {
    return tokensMatch(alert.accessToken, accessToken);
  }
  return false;
}
