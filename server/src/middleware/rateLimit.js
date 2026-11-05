import { env } from '../config/env.js';

const buckets = new Map();
const MAX_BUCKETS = 10_000;

function cleanup(now) {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Lightweight in-process rate limiter. On serverless platforms this protects
 * each warm instance; a shared store (Redis) is required for global limits.
 */
export function createRateLimiter({
  name,
  windowMs = 60_000,
  max = 60,
  message = 'Too many requests. Please try again shortly.',
  keyGenerator,
}) {
  return function rateLimiter(req, res, next) {
    if (!env.rateLimitEnabled) return next();

    const identity = keyGenerator
      ? keyGenerator(req)
      : req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${name}:${identity}`;
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
      if (buckets.size > MAX_BUCKETS) cleanup(now);
    }

    entry.count += 1;
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(retryAfter));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message });
    }

    return next();
  };
}

export const aiLimiter = createRateLimiter({
  name: 'ai',
  windowMs: 60_000,
  max: 30,
  message: 'Too many AI requests. Please wait a moment and try again.',
});

export const uploadLimiter = createRateLimiter({
  name: 'upload',
  windowMs: 5 * 60_000,
  max: 15,
  message: 'Too many document or audio uploads. Please wait a few minutes.',
});

export const sosLimiter = createRateLimiter({
  name: 'sos',
  windowMs: 60_000,
  max: 20,
  message: 'Too many emergency requests. If this is life-threatening, call 112 immediately.',
});

export const healthLimiter = createRateLimiter({
  name: 'health',
  windowMs: 60_000,
  max: 180,
  message: 'Too many health record requests. Please slow down.',
});

export const writeLimiter = createRateLimiter({
  name: 'write',
  windowMs: 60_000,
  max: 90,
  message: 'Too many changes. Please wait a moment and try again.',
});
