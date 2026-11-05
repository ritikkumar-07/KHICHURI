import assert from 'node:assert/strict';
import test from 'node:test';

process.env.RATE_LIMIT_ENABLED = 'true';

const { createRateLimiter } = await import('../src/middleware/rateLimit.js');

function response() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('rate limiter blocks requests after the configured threshold', () => {
  const limiter = createRateLimiter({
    name: 'integration-limit',
    windowMs: 60_000,
    max: 2,
  });
  const req = { ip: '203.0.113.10' };

  const first = response();
  let continued = 0;
  limiter(req, first, () => {
    continued += 1;
  });
  const second = response();
  limiter(req, second, () => {
    continued += 1;
  });
  const third = response();
  limiter(req, third, () => {
    continued += 1;
  });

  assert.equal(continued, 2);
  assert.equal(first.statusCode, 200);
  assert.equal(second.headers['RateLimit-Remaining'], '0');
  assert.equal(third.statusCode, 429);
  assert.equal(third.body.success, false);
  assert.ok(Number(third.headers['Retry-After']) >= 1);
});
