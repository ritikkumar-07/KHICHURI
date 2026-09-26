import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

import { env } from './config/env.js';
import { connectDb, databaseMode } from './config/db.js';

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

// ============================================================
// CORS
// ============================================================

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://sanjeevani-sooty.vercel.app',
];

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server / health-check requests
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn('[CORS] Blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'x-health-owner-key',
  ],

  exposedHeaders: [
    'Content-Length',
  ],

  maxAge: 600,
};

// ============================================================
// EXPRESS
// ============================================================

const app = express();

app.disable('x-powered-by');

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: '30mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '30mb',
  })
);

// ============================================================
// HTTP SERVER
// ============================================================

const http = createServer(app);

// ============================================================
// SOCKET.IO
// ============================================================

const io = new Server(http, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },

  transports: [
    'polling',
    'websocket',
  ],
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'operational',
      database: databaseMode,
      demoMode: databaseMode === 'memory',
      environment: process.env.VERCEL
        ? 'vercel'
        : 'local',
    },
  });
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/triage', triageRoutes);

app.use('/api/voice', voiceRoutes);

app.use('/api/facilities', facilityRoutes);

app.use('/api/sos', sosRoutes);

app.use('/api/simplify-report', ocrRoutes);

app.use('/api/health-tracker', healthTrackerRoutes);

app.use('/api/medicines', medicineRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/emergency', emergencyRoutes);

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

app.use((error, _req, res, _next) => {
  console.error(
    '[SERVER ERROR]',
    error?.stack || error?.message || error
  );

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    success: false,
    message: 'The server could not complete that request.',
  });
});

// ============================================================
// SOCKET EVENTS
// ============================================================

configureEmergencySocket(io);

// ============================================================
// DATABASE
// ============================================================
//
// IMPORTANT:
// MongoDB must NOT control whether the HTTP server starts.
// If MongoDB is unavailable, the application stays alive in
// demo/in-memory mode.
//

connectDb()
  .then(() => {
    console.info(
      '[DB] Database initialization completed'
    );
  })
  .catch((error) => {
    console.error(
      '[DB] Database initialization failed:',
      error?.stack || error?.message || error
    );
  });

// ============================================================
// LOCAL DEVELOPMENT ONLY
// ============================================================
//
// Vercel manages the server/function itself.
// Do not call listen() inside the Vercel environment.
//

if (!process.env.VERCEL) {
  const port = Number(
    process.env.PORT || env.port || 5000
  );

  http.listen(port, () => {
    console.info(
      `Sanjeevani API running locally on port ${port}`
    );
  });
}

// ============================================================
// VERCEL / SERVER EXPORT
// ============================================================

export default http;
