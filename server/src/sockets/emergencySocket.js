import { randomBytes, randomUUID } from 'node:crypto';
import { databaseMode } from '../config/db.js';
import { logger } from '../lib/logger.js';
import { SosAlert } from '../models/SosAlert.js';
import {
  canAccessSosAlert,
  isHospitalAdmin,
  resolveUserFromToken,
} from '../middleware/auth.js';

export const alerts = new Map();
const deliveryAcks = new Map();

const ALERT_TTL_MS = 60 * 60 * 1000;
const MAX_ALERTS = 5000;
const VALID_URGENCIES = new Set(['RED', 'YELLOW', 'GREEN']);
const ALERT_ID_PATTERN = /^SOS-[A-Za-z0-9-]{8,80}$/;

let io;
let cleanupTimer;

const safeText = (value, max = 500) =>
  typeof value === 'string'
    ? value
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .trim()
        .slice(0, max)
    : '';

export function publicSosAlert(alert) {
  if (!alert) return null;
  return {
    id: alert.id,
    coordinates: {
      latitude: alert.coordinates?.latitude,
      longitude: alert.coordinates?.longitude,
    },
    timestamp: alert.timestamp,
    urgency: alert.urgency,
    conditionSummary: alert.conditionSummary,
    status: alert.status,
    etaMinutes: alert.etaMinutes,
    version: alert.version || 1,
    updatedAt: alert.updatedAt || alert.timestamp,
    deliveryState: alert.deliveryState || 'pending',
    ...(alert.acknowledgedAt
      ? { acknowledgedAt: alert.acknowledgedAt }
      : {}),
  };
}

function bumpAlert(alert) {
  alert.version = Number(alert.version || 0) + 1;
  alert.updatedAt = new Date().toISOString();
}

function responderRoomSize() {
  return io?.sockets?.adapter?.rooms?.get('responders')?.size || 0;
}

function markDelivered(alert) {
  if (responderRoomSize() === 0) return false;
  if (alert.deliveryState === 'delivered' || alert.deliveryState === 'acknowledged') {
    return false;
  }

  alert.deliveryState = 'delivered';
  alert.deliveredAt = alert.deliveredAt || new Date().toISOString();
  bumpAlert(alert);
  return true;
}

function removeAlert(id) {
  alerts.delete(id);
  deliveryAcks.delete(id);
}

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - ALERT_TTL_MS;
    for (const [id, alert] of alerts) {
      if (new Date(alert.timestamp).getTime() < cutoff) {
        removeAlert(id);
      }
    }
  }, 5 * 60 * 1000);
  cleanupTimer.unref?.();
}

function enforceCapacity() {
  while (alerts.size > MAX_ALERTS) {
    const oldestId = alerts.keys().next().value;
    if (!oldestId) break;
    removeAlert(oldestId);
  }
}

function emitToAlert(event, alert) {
  if (!io) return;

  if (markDelivered(alert)) {
    void persistAlert(alert);
  }

  const rooms = new Set([`sos:${alert.id}`]);
  if (alert.ownerId) rooms.add(`user:${alert.ownerId}`);
  rooms.add('responders');

  let target = io;
  for (const room of rooms) target = target.to(room);
  target.emit(event, publicSosAlert(alert));
}

async function persistAlert(alert) {
  if (databaseMode !== 'mongo') return;
  try {
    await SosAlert.findOneAndUpdate(
      { alertId: alert.id },
      {
        $set: {
          alertId: alert.id,
          ownerId: alert.ownerId || null,
          coordinates: alert.coordinates,
          timestamp: new Date(alert.timestamp),
          urgency: alert.urgency,
          conditionSummary: alert.conditionSummary,
          status: alert.status,
          etaMinutes: alert.etaMinutes,
          accessToken: alert.accessToken || null,
          acknowledgedAt: alert.acknowledgedAt
            ? new Date(alert.acknowledgedAt)
            : null,
          version: alert.version || 1,
          deliveryState: alert.deliveryState || 'pending',
          deliveredAt: alert.deliveredAt ? new Date(alert.deliveredAt) : null,
          deliveryAckCount: alert.deliveryAckCount || 0,
          lastDeliveryAckAt: alert.lastDeliveryAckAt
            ? new Date(alert.lastDeliveryAckAt)
            : null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    logger.error('sos_persist_failed', {
      alertId: alert.id,
      error: { name: error?.name, message: error?.message },
    });
  }
}

function scheduleStatusUpdates(alert) {
  const dispatching = setTimeout(() => {
    if (alerts.get(alert.id)?.status !== 'received') return;
    alert.status = 'dispatching';
    bumpAlert(alert);
    emitToAlert('sos:update', alert);
    void persistAlert(alert);
  }, 1200);
  dispatching.unref?.();

  const enRoute = setTimeout(() => {
    if (alerts.get(alert.id)?.status !== 'dispatching') return;
    alert.status = 'en_route';
    alert.etaMinutes = 9;
    bumpAlert(alert);
    emitToAlert('sos:update', alert);
    void persistAlert(alert);
  }, 3000);
  enRoute.unref?.();
}

export async function createSos(input, user = null) {
  const latitude = Number(input?.latitude);
  const longitude = Number(input?.longitude);

  const alert = {
    id: `SOS-${randomUUID()}`,
    coordinates: { latitude, longitude },
    timestamp: new Date().toISOString(),
    urgency: VALID_URGENCIES.has(input?.urgency) ? input.urgency : 'RED',
    conditionSummary:
      safeText(input?.conditionSummary, 500) || 'Emergency assistance requested',
    status: 'received',
    etaMinutes: 12,
    ownerId: user?.id || null,
    accessToken: user?.id ? null : randomBytes(32).toString('base64url'),
    version: 1,
    updatedAt: new Date().toISOString(),
    deliveryState: 'pending',
    deliveredAt: null,
    deliveryAckCount: 0,
    lastDeliveryAckAt: null,
  };

  alerts.set(alert.id, alert);
  enforceCapacity();
  ensureCleanupTimer();

  await persistAlert(alert);
  emitToAlert('sos:created', alert);
  scheduleStatusUpdates(alert);

  return alert;
}

export async function findSos(id) {
  if (typeof id !== 'string' || !ALERT_ID_PATTERN.test(id)) return null;

  const inMemory = alerts.get(id);
  if (inMemory) return inMemory;

  if (databaseMode === 'mongo') {
    try {
      const document = await SosAlert.findOne({ alertId: id }).lean();
      if (document) {
        return {
          id: document.alertId,
          coordinates: document.coordinates,
          timestamp: document.timestamp?.toISOString?.() || document.timestamp,
          urgency: document.urgency,
          conditionSummary: document.conditionSummary,
          status: document.status,
          etaMinutes: document.etaMinutes,
          ownerId: document.ownerId || null,
          accessToken: document.accessToken || null,
          acknowledgedAt:
            document.acknowledgedAt?.toISOString?.() || document.acknowledgedAt,
          version: document.version || 1,
          updatedAt:
            document.updatedAt?.toISOString?.() ||
            document.timestamp?.toISOString?.() ||
            document.timestamp,
          deliveryState: document.deliveryState || 'pending',
          deliveredAt:
            document.deliveredAt?.toISOString?.() || document.deliveredAt || null,
          deliveryAckCount: document.deliveryAckCount || 0,
          lastDeliveryAckAt:
            document.lastDeliveryAckAt?.toISOString?.() ||
            document.lastDeliveryAckAt ||
            null,
        };
      }
    } catch (error) {
      logger.error('sos_load_failed', {
        alertId: id,
        error: { name: error?.name, message: error?.message },
      });
    }
  }

  return null;
}

export async function acknowledgeSos(id, user) {
  if (!isHospitalAdmin(user)) {
    return { ok: false, code: 'FORBIDDEN' };
  }

  const alert = await findSos(id);
  if (!alert) return { ok: false, code: 'NOT_FOUND' };

  if (!alert.acknowledgedAt) {
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.deliveryState = 'acknowledged';
    alert.deliveredAt = alert.deliveredAt || alert.acknowledgedAt;
    bumpAlert(alert);
    if (alerts.has(alert.id)) alerts.set(alert.id, alert);
    await persistAlert(alert);
  }

  emitToAlert('sos:acknowledged', alert);
  return { ok: true, alert };
}

export function configureEmergencySocket(server) {
  io = server;

  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    socket.user = null;
    if (token) {
      try {
        socket.user = await resolveUserFromToken(token);
      } catch (error) {
        // A bad token must not prevent a person in danger from connecting.
        // The socket simply stays anonymous and cannot acknowledge alerts.
        logger.warn('socket_auth_ignored', {
          error: { name: error?.name, message: error?.message },
        });
      }
    }

    next();
  });

  io.on('connection', (socket) => {
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }
    if (isHospitalAdmin(socket.user)) {
      socket.join('responders');
    }

    socket.on('sos:subscribe', async (payload) => {
      const id = typeof payload === 'string' ? payload : payload?.id;
      const accessToken =
        typeof payload === 'object' ? payload?.token : null;
      if (typeof id !== 'string' || !ALERT_ID_PATTERN.test(id)) return;

      const alert = await findSos(id);
      if (!alert) return;

      if (!canAccessSosAlert(alert, socket.user, accessToken)) {
        return;
      }

      socket.join(`sos:${id}`);
      if (isHospitalAdmin(socket.user) && markDelivered(alert)) {
        if (alerts.has(alert.id)) alerts.set(alert.id, alert);
        await persistAlert(alert);
      }
      socket.emit('sos:update', publicSosAlert(alert));
    });

    socket.on('sos:delivery-ack', async (id) => {
      if (typeof id !== 'string' || !ALERT_ID_PATTERN.test(id)) return;

      if (!isHospitalAdmin(socket.user)) return;

      const alert = await findSos(id);
      if (!alert) return;

      const acknowledged = deliveryAcks.get(id) || new Set();
      if (acknowledged.has(socket.id)) return;
      acknowledged.add(socket.id);
      deliveryAcks.set(id, acknowledged);

      alert.deliveryState = 'acknowledged';
      alert.deliveredAt = alert.deliveredAt || new Date().toISOString();
      alert.deliveryAckCount = acknowledged.size;
      alert.lastDeliveryAckAt = new Date().toISOString();
      bumpAlert(alert);

      if (alerts.has(alert.id)) alerts.set(alert.id, alert);
      await persistAlert(alert);
      emitToAlert('sos:update', alert);
    });

    socket.on('sos:acknowledge', async (id) => {
      if (typeof id !== 'string' || !ALERT_ID_PATTERN.test(id)) return;

      const result = await acknowledgeSos(id, socket.user);
      if (!result.ok) return;
      socket.emit('sos:acknowledged', publicSosAlert(result.alert));
    });
  });
}
