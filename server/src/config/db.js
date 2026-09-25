import mongoose from 'mongoose';
import { env } from './env.js';
import { supabase, isSupabaseConfigured, checkSupabaseConnection } from './supabase.js';

export let databaseMode = 'memory';

export async function connectDb() {
  if (isSupabaseConfigured) {
    console.info('Database: Supabase connection slot initialized');
  }

  if (!env.mongoUri) {
    console.info('Database: in-memory demo mode');
    return;
  }
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 4000 });
    databaseMode = 'mongo';
    console.info('Database: MongoDB connected');
  } catch (e) {
    console.warn('Database unavailable; using in-memory demo mode');
  }
}

export { supabase, isSupabaseConfigured, checkSupabaseConnection };
