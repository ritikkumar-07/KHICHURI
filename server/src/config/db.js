import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../lib/logger.js';
import {
  supabase,
  isSupabaseConfigured,
  checkSupabaseConnection,
} from './supabase.js';

mongoose.set('strictQuery', true);
// Fail fast instead of silently buffering operations for a disconnected DB.
// Routes that need MongoDB await connectDb() before touching a model.
mongoose.set('bufferCommands', false);

export let databaseMode = env.mongoUri ? 'connecting' : 'memory';

let connectPromise = null;
let lastFailureAt = 0;
let lastError = null;
let memoryModeLogged = false;
const RETRY_COOLDOWN_MS = 60_000;

const stateNames = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

export function isDatabaseReady() {
  if (!env.mongoUri) {
    return !env.strictProduction || env.allowMemoryDb;
  }
  return isMongoConnected();
}

export function getDatabaseStatus() {
  return {
    mode: databaseMode,
    configured: Boolean(env.mongoUri),
    ready: isDatabaseReady(),
    readyState: stateNames[mongoose.connection.readyState] || 'unknown',
    lastFailureAt: lastFailureAt ? new Date(lastFailureAt).toISOString() : null,
    lastError: lastError?.name || null,
  };
}

async function attemptConnection() {
  if (lastFailureAt && Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) {
    return;
  }

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 20_000,
      maxPoolSize: 10,
    });
    databaseMode = 'mongo';
    lastFailureAt = 0;
    lastError = null;
    logger.info('database_connected');
  } catch (error) {
    databaseMode = 'unavailable';
    lastFailureAt = Date.now();
    lastError = error;
    logger.error('database_connection_failed', {
      error: { name: error?.name, message: error?.message },
    });
  }
}

export async function connectDb() {
  if (!env.mongoUri) {
    databaseMode = 'memory';
    if (!memoryModeLogged) {
      memoryModeLogged = true;
      logger.info('database_memory_mode');
    }
    return;
  }

  if (databaseMode === 'mongo' && isMongoConnected()) return;

  if (!connectPromise) {
    connectPromise = attemptConnection().finally(() => {
      connectPromise = null;
    });
  }

  return connectPromise;
}

export async function checkDatabaseReadiness() {
  if (!env.mongoUri) {
    return {
      ready: !env.strictProduction || env.allowMemoryDb,
      mode: 'memory',
      configured: false,
      state: 'in-memory',
    };
  }

  await connectDb();

  if (!isMongoConnected()) {
    return {
      ready: false,
      mode: databaseMode,
      configured: true,
      state: stateNames[mongoose.connection.readyState] || 'unknown',
    };
  }

  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database ping timed out')), 2000);
      }),
    ]);
    return { ready: true, mode: 'mongo', configured: true, state: 'connected' };
  } catch (error) {
    lastError = error;
    return {
      ready: false,
      mode: databaseMode,
      configured: true,
      state: 'ping-failed',
    };
  }
}

mongoose.connection.on('disconnected', () => {
  if (databaseMode === 'mongo') {
    databaseMode = 'unavailable';
    logger.error('database_disconnected');
  }
});

mongoose.connection.on('reconnected', () => {
  databaseMode = 'mongo';
  lastError = null;
  logger.info('database_reconnected');
});

mongoose.connection.on('error', (error) => {
  lastError = error;
  logger.error('database_error', {
    error: { name: error?.name, message: error?.message },
  });
});

if (isSupabaseConfigured) {
  logger.info('supabase_connection_initialized');
}

export { supabase, isSupabaseConfigured, checkSupabaseConnection };
