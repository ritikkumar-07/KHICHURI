import { createSos, alerts } from '../sockets/emergencySocket.js';
export function postSos(req, res) { const { latitude, longitude, urgency = 'RED', conditionSummary = 'Emergency assistance requested' } = req.body || {}; if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)))
    return res.status(400).json({ success: false, message: 'Valid coordinates are required.' }); const alert = createSos({ latitude: Number(latitude), longitude: Number(longitude), urgency, conditionSummary }); res.status(201).json({ success: true, data: alert }); }
export function getSos(req, res) { const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id; const a = alerts.get(id); if (!a)
    return res.status(404).json({ success: false, message: 'SOS alert not found.' }); res.json({ success: true, data: a }); }
