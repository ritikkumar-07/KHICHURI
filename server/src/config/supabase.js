import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Validates if Supabase credentials are provided and not dummy placeholders
 */
export const isSupabaseConfigured = Boolean(
  env.supabaseUrl &&
  env.supabaseAnonKey &&
  !env.supabaseUrl.includes('your-project-id') &&
  !env.supabaseAnonKey.includes('your-supabase-anon-key')
);

/**
 * Server-side Supabase client slot for PostgreSQL queries, RLS policies, and Auth verification.
 */
export const supabase = (env.supabaseUrl && env.supabaseAnonKey)
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
    const { error } = await supabase.auth.getSession();
    if (error) {
      return { configured: true, status: 'error', message: error.message };
    }
    return { configured: true, status: 'connected' };
  } catch (error) {
    return { configured: true, status: 'error', message: error?.message || 'Connection check failed' };
  }
}
