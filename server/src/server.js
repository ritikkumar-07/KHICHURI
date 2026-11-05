import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

import { env } from './config/env.js';
import { validateEnvironment } from './config/validateEnv.js';
import {
  checkDatabaseReadiness,
  connectDb,
  getDatabaseStatus,
  isDatabaseReady,
} from './config/db.js';
import { logger } from './lib/logger.js';
import { captureException } from './lib/monitoring.js';
import {
  getRouteLabel,
  requestContext,
} from './middleware/requestContext.js';

import triageRoutes from './routes/triageRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import facilityRoutes from './routes/facilityRoutes.js';
import sosRoutes from './routes/sosRoutes.js';
import ocrRoutes from './routes/ocrRoutes.js';
import healthTrackerRoutes from './routes/healthTrackerRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';

import { configureEmergencySocket } from './sockets/emergencySocket.js';
import {
  aiLimiter,
  uploadLimiter,
  sosLimiter,
  healthLimiter,
} from './middleware/rateLimit.js';

// ============================================================
// CORS
// ============================================================

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server / health-check requests with no Origin header.
    if (!origin) return callback(null, true);

    if (env.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn('cors_origin_blocked', { origin });
    const error = new Error('Origin not allowed by CORS');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'x-health-owner-key',
    'x-sos-token',
    'x-request-id',
  ],
  exposedHeaders: [
    'Content-Length',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
    'Retry-After',
    'x-request-id',
  ],
  maxAge: 600,
};

// ============================================================
// EXPRESS
// ============================================================

const app = express();

app.disable('x-powered-by');

const trustProxy =
  env.trustProxy === 'true'
    ? true
    : env.trustProxy === 'false'
      ? false
      : Number.isNaN(Number(env.trustProxy))
        ? env.trustProxy
        : Number(env.trustProxy);
app.set('trust proxy', trustProxy);

app.use(requestContext);
app.use(cors(corsOptions));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (env.isProduction || req.secure) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Express leaves req.body undefined for requests without a JSON body. Many
// handlers expect an object and would otherwise throw a TypeError.
app.use((req, _res, next) => {
  if (req.body === undefined || req.body === null) req.body = {};
  next();
});

// ============================================================
// HTTP + SOCKET.IO
// ============================================================

const http = createServer(app);

const io = new Server(http, {
  cors: {
    origin: env.allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
  maxHttpBufferSize: 100_000,
  pingTimeout: 20_000,
});

if (env.isVercel) {
  logger.warn('socket_realtime_unsupported_on_vercel');
}

configureEmergencySocket(io);

// ============================================================
// DATABASE READINESS
// ============================================================

async function ensureDatabase(_req, _res, next) {
  try {
    await connectDb();
    if (!isDatabaseReady()) {
      const error = new Error('The database is temporarily unavailable.');
      error.status = 503;
      return next(error);
    }
    next();
  } catch (error) {
    next(error);
  }
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (_req, res) => {
  const database = getDatabaseStatus();

  res.status(200).json({
    success: true,
    data: {
      status: database.ready ? 'operational' : 'degraded',
      database: database.mode,
      databaseConfigured: database.configured,
      databaseReady: database.ready,
      databaseState: database.readyState,
      demoMode: database.mode === 'memory',
      environment: env.isVercel
        ? 'vercel'
        : env.isProduction
          ? 'production'
          : 'local',
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/triage', aiLimiter, triageRoutes);
app.use('/api/voice', aiLimiter, voiceRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/sos', sosLimiter, sosRoutes);
app.use('/api/simplify-report', uploadLimiter, ocrRoutes);
app.use('/api/health-tracker', healthLimiter, ensureDatabase, healthTrackerRoutes);
app.use('/api/medicines', aiLimiter, medicineRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/emergency', healthLimiter, ensureDatabase, emergencyRoutes);

const environmentValidation = validateEnvironment();

app.get('/api/ready', async (_req, res) => {
  let database;
  try {
    database = await checkDatabaseReadiness();
  } catch (error) {
    captureException(error, { source: 'readiness_check' });
    database = {
      ready: false,
      mode: 'unavailable',
      configured: Boolean(env.mongoUri),
      state: 'check-failed',
    };
  }

  const ready = environmentValidation.valid && database.ready;

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      ready,
      checks: {
        configuration: environmentValidation.valid,
        database: database.ready,
      },
      database: {
        mode: database.mode,
        configured: database.configured,
        state: database.state,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================
// 404
// ============================================================

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((error, req, res, _next) => {
  if (res.headersSent) return;

  let status = Number(error.status || error.statusCode) || 500;
  let message = 'The server could not complete that request.';

  if (error.type === 'entity.too.large') {
    status = 413;
    message = 'The request payload is too large.';
  } else if (error instanceof SyntaxError && status === 400) {
    status = 400;
    message = 'The request body contains invalid JSON.';
  } else if (error.name === 'MulterError') {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'The uploaded file is too large.'
        : 'The uploaded file is not valid.';
  } else if (status === 403 && /CORS/i.test(error.message || '')) {
    message = 'This origin is not allowed to access the API.';
  } else if (status >= 500) {
    captureException(error, {
      requestId: req.requestId,
      method: req.method,
      route: getRouteLabel(req),
      status,
    });
  } else if (status >= 400 && status < 500 && error.message) {
    message = error.message;
  }

  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
  }

  res.status(status).json({ success: false, message });
});

// ============================================================
// UNHANDLED ERRORS
// ============================================================

process.on('unhandledRejection', (reason) => {
  captureException(
    reason instanceof Error ? reason : new Error(String(reason)),
    { source: 'unhandledRejection' }
  );
});

process.on('uncaughtException', (error) => {
  captureException(error, { source: 'uncaughtException' });
  if (!env.isVercel) process.exitCode = 1;
});

// ============================================================
// STARTUP
// ============================================================

if (environmentValidation.errors.length > 0) {
  logger.error('configuration_invalid', {
    errors: environmentValidation.errors,
  });
}
if (environmentValidation.warnings.length > 0) {
  logger.warn('configuration_warnings', {
    warnings: environmentValidation.warnings,
  });
}

connectDb()
  .then(() => {
    logger.info('database_initialization_completed');
  })
  .catch((error) => {
    captureException(error, { source: 'database_initialization' });
  });

const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (!env.isVercel && isMainModule) {
  if (env.strictProduction && !environmentValidation.valid) {
    logger.error('server_start_blocked_invalid_configuration');
    process.exitCode = 1;
  } else {
    const port = Number(process.env.PORT || env.port || 5000);

    const server = http.listen(port, () => {
      logger.info('server_started', { port });
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info('server_shutdown_started', { signal });

      const forceExit = setTimeout(() => {
        logger.error('server_forced_shutdown');
        process.exit(1);
      }, 10_000);
      forceExit.unref();

      io.close();
      server.close(async () => {
        try {
          await mongoose.disconnect();
        } catch (error) {
          logger.error('database_disconnect_failed', {
            error: { name: error?.name, message: error?.message },
          });
        }
        clearTimeout(forceExit);
        process.exit(0);
      });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }
}

// Vercel expects the Express application as the default export.
export default app;
export { app, http, io };
