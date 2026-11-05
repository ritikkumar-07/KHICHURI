import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { logger } from '../lib/logger.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function redactPath(pathname) {
  if (!pathname) return '/';
  if (pathname.startsWith('/api/sos/')) return '/api/sos/:id';
  if (pathname.startsWith('/api/emergency/')) return '/api/emergency/:id';
  return pathname;
}

export function getRouteLabel(req) {
  if (req.route?.path) {
    return `${req.baseUrl || ''}${req.route.path}` || req.route.path;
  }
  return redactPath(req.path);
}

export function requestContext(req, res, next) {
  const supplied = req.get('x-request-id');
  const requestId =
    typeof supplied === 'string' && REQUEST_ID_PATTERN.test(supplied)
      ? supplied
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = performance.now();
  let finished = false;

  const finishLog = (aborted) => {
    if (finished) return;
    finished = true;

    const fields = {
      requestId,
      method: req.method,
      route: getRouteLabel(req),
      status: res.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    };

    if (req.user?.id) fields.userId = req.user.id;
    if (aborted) fields.aborted = true;

    if (res.statusCode >= 500) {
      logger.error('http_request_completed', fields);
    } else if (res.statusCode >= 400) {
      logger.warn('http_request_completed', fields);
    } else {
      logger.info('http_request_completed', fields);
    }
  };

  res.once('finish', () => finishLog(false));
  res.once('close', () => {
    if (!res.writableFinished) finishLog(true);
  });

  next();
}
