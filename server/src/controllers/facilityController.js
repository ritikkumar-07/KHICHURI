import { nearby } from '../services/mapService.js';

export function getNearby(req, res) {
  const hasLatitude = req.query.latitude !== undefined && req.query.latitude !== '';
  const hasLongitude = req.query.longitude !== undefined && req.query.longitude !== '';

  const latitude = hasLatitude ? Number(req.query.latitude) : 22.5726;
  const longitude = hasLongitude ? Number(req.query.longitude) : 88.3639;
  const requestedRadius = Number(req.query.radius);
  const radius = Math.min(
    Math.max(Number.isFinite(requestedRadius) ? requestedRadius : 10, 1),
    100
  );

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
      message: 'Valid latitude and longitude are required.',
    });
  }

  return res.json({
    success: true,
    data: nearby(latitude, longitude, radius),
    mode: 'demo',
  });
}
