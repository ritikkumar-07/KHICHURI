import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Validates if Supabase credentials are provided and not dummy placeholders
 */
const hasPlaceholderValues = Boolean(
  env.supabaseUrl.includes('your-project-id') ||
    env.supabaseAnonKey.includes('your-supabase-anon-key')
);

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey && !hasPlaceholderValues
);

/**
 * Server-side Supabase client slot for PostgreSQL queries, RLS policies, and Auth verification.
 */
export const supabase = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

/**
 * Health / connectivity verification slot for Supabase connection
 */
export async function checkSupabaseConnection() {
  if (!supabase || !isSupabaseConfigured) {
    return { configured: false, status: 'unconfigured' };
  }
  try {
    const response = await fetch(
      `${env.supabaseUrl.replace(/\/$/, '')}/auth/v1/health`,
      {
        headers: { apikey: env.supabaseAnonKey },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!response.ok) {
      return {
        configured: true,
        status: 'error',
        message: `Supabase health check returned ${response.status}`,
      };
    }
    return { configured: true, status: 'connected' };
  } catch (error) {
    return {
      configured: true,
      status: 'error',
      message: error?.message || 'Connection check failed',
    };
  }
}
