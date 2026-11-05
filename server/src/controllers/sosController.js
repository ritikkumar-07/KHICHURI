import {
  createSos,
  findSos,
  publicSosAlert,
} from '../sockets/emergencySocket.js';
import { canAccessSosAlert } from '../middleware/auth.js';

const VALID_URGENCIES = new Set(['RED', 'YELLOW', 'GREEN']);

export async function postSos(req, res, next) {
  try {
    const body = req.body || {};
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates are required.',
      });
    }

    const requestedUrgency = String(body.urgency || 'RED').toUpperCase();
    const urgency = VALID_URGENCIES.has(requestedUrgency)
      ? requestedUrgency
      : 'RED';
    const conditionSummary =
      typeof body.conditionSummary === 'string'
        ? body.conditionSummary.trim().slice(0, 500)
        : '';

    const alert = await createSos(
      { latitude, longitude, urgency, conditionSummary },
      req.user || null
    );

    res.setHeader('Cache-Control', 'no-store');
    const data = publicSosAlert(alert);
    if (!alert.ownerId && alert.accessToken) {
      data.accessToken = alert.accessToken;
    }
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function getSos(req, res, next) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const alert = await findSos(id);
    const accessToken =
      req.get('x-sos-token') || req.query.token || null;

    if (!alert || !canAccessSosAlert(alert, req.user, accessToken)) {
      return res.status(404).json({
        success: false,
        message: 'SOS alert not found.',
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: publicSosAlert(alert) });
  } catch (error) {
    return next(error);
  }
}
