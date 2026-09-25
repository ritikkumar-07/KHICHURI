import 'dotenv/config';
// trigger restart
import express from 'express';

console.log("Gemini Key loaded:", process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 6)}...` : "MISSING");

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
// ---------------------------------------------------------------------------
// Shared CORS config — used by both app.use() and OPTIONS preflight handler
// so both always return identical Access-Control-Allow-* headers.
// ---------------------------------------------------------------------------
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      env.clientUrl
    ];
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'x-health-owner-key',   // required by /api/health-tracker endpoints
  ],
  exposedHeaders: ['Content-Length'],
  maxAge: 600,              // cache preflight 10 min — reduces OPTIONS traffic
};

const app = express(), http = createServer(app), io = new Server(http, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

// Apply CORS before every route — including OPTIONS preflight.
// CRITICAL: both calls must share corsOptions, otherwise the preflight
// response will advertise different headers than the actual response.
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));
app.get('/api/health', (_q, r) => r.json({ success: true, data: { status: 'operational', database: databaseMode, demoMode: databaseMode === 'memory' } }));
app.use('/api/triage', triageRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/simplify-report', ocrRoutes);
app.use('/api/health-tracker', healthTrackerRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use((_q, r) => r.status(404).json({ success: false, message: 'Route not found' }));
app.use((error, _req, res, _next) => {
  console.error('Request failed:', error?.name || 'Error');
  res.status(500).json({ success: false, message: 'The server could not complete that request. Please try again.' });
});
configureEmergencySocket(io);
connectDb().finally(() => {
  const port = process.env.PORT || env.port || 5000;
  const server = http.listen(port, () => console.info(`Sanjeevani API running strictly on port ${port}`));
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`FATAL: Port ${port} is already in use. Please kill the process using this port before starting.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
});
