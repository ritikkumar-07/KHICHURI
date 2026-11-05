import { createClient } from '@supabase/supabase-js';

const sanitize = (val) => {
  if (!val) return '';
  let str = String(val).trim();
  // Strip enclosing quotes if present
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  // Strip markdown link syntax like [https://...](https://...)
  const mdMatch = str.match(/\[(?:.*?)\]\((.*?)\)/);
  if (mdMatch) {
    str = mdMatch[1];
  }
  return str.trim();
};

const isPlaceholder = (val) =>
  !val ||
  val.includes('your-project-id') ||
  val.includes('your-supabase-anon-key');

const rawUrl = sanitize(import.meta.env.VITE_SUPABASE_URL);
const rawKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

const url = isPlaceholder(rawUrl) ? '' : rawUrl;
const anonKey = isPlaceholder(rawKey) ? '' : rawKey;

// True when valid Supabase credentials are ready for authentication
export const authConfigured = Boolean(url && anonKey);

// General Supabase configuration status flag
export const isSupabaseConfigured = authConfigured;

// Clean Supabase client instance for Auth, Database (PostgreSQL/RLS), and Realtime
export const supabase = authConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
