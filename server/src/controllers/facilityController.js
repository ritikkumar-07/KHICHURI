import { nearby } from '../services/mapService.js';
export function getNearby(req, res) { const latitude = Number(req.query.latitude) || 22.5726, longitude = Number(req.query.longitude) || 88.3639, radius = Math.min(Math.max(Number(req.query.radius) || 10, 1), 100); res.json({ success: true, data: nearby(latitude, longitude, radius), mode: 'demo' }); }
