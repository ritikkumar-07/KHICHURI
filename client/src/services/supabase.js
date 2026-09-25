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

const DEFAULT_URL = 'https://gdwhqlkurweorigeuzdd.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdkd2hxbGt1cndlb3JpZ2V1emRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMjg0ODMsImV4cCI6MjEwNTkwNDQ4M30.QzvEB434ida3djFQb4mIkBdRf--xOGvVhQtMvHOP_YE';

const isPlaceholder = (val) =>
  !val ||
  val.includes('your-project-id') ||
  val.includes('your-supabase-anon-key');

const rawUrl = sanitize(import.meta.env.VITE_SUPABASE_URL);
const rawKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

const url = (!isPlaceholder(rawUrl)) ? rawUrl : DEFAULT_URL;
const anonKey = (!isPlaceholder(rawKey)) ? rawKey : DEFAULT_ANON_KEY;

// True when valid Supabase credentials are ready for authentication
export const authConfigured = Boolean(url && anonKey && !isPlaceholder(url));

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
