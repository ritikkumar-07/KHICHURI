import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';

let http;
let io;
let baseUrl;

const auth = (token = 'demo-token') => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

before(async () => {
  const server = await import('../src/server.js');
  http = server.http;
  io = server.io;

  await new Promise((resolve) => {
    http.listen(0, '127.0.0.1', resolve);
  });
  const address = http.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (io) {
    await new Promise((resolve) => io.close(resolve));
  }
  if (http?.listening) {
    await new Promise((resolve) => http.close(resolve));
  }
});

test('health and readiness expose request IDs and safe status', async () => {
  const health = await request('/api/health', {
    headers: { 'x-request-id': 'integration-request-1234' },
  });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-request-id'), 'integration-request-1234');

  const body = await health.json();
  assert.equal(body.success, true);
  assert.equal(body.data.databaseReady, true);
  assert.equal(body.data.databaseConfigured, false);

  const ready = await request('/api/ready', {
    headers: { 'x-request-id': 'not valid because spaces' },
  });
  assert.equal(ready.status, 200);
  assert.match(ready.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  const readyBody = await ready.json();
  assert.equal(readyBody.data.ready, true);
});

test('malformed JSON and untrusted CORS origins fail safely', async () => {
  const malformed = await request('/api/sos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);
  const malformedBody = await malformed.json();
  assert.equal(malformedBody.success, false);
  assert.match(malformedBody.message, /invalid JSON/i);

  const blocked = await request('/api/health', {
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(blocked.status, 403);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.success, false);
  assert.match(blockedBody.message, /origin is not allowed/i);
});

test('anonymous SOS requires its capability token and never leaks it on read', async () => {
  const created = await request('/api/sos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: 22.57,
      longitude: 88.36,
      urgency: 'RED',
      conditionSummary: 'Integration test emergency',
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  const alert = createdBody.data;
  assert.match(alert.id, /^SOS-/);
  assert.match(alert.accessToken, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(alert.version, 1);

  const denied = await request(`/api/sos/${alert.id}`, {
    headers: { 'x-sos-token': 'wrong-token' },
  });
  assert.equal(denied.status, 404);

  const injected = await request(
    `/api/sos/${encodeURIComponent('{"$ne":null}')}`
  );
  assert.equal(injected.status, 404);

  const allowed = await request(`/api/sos/${alert.id}`, {
    headers: { 'x-sos-token': alert.accessToken },
  });
  assert.equal(allowed.status, 200);
  const allowedBody = await allowed.json();
  assert.equal(allowedBody.data.id, alert.id);
  assert.equal(allowedBody.data.accessToken, undefined);
  assert.equal(allowedBody.data.ownerId, undefined);
});

test('admin routes reject demo users and accept demo admins', async () => {
  const user = await request('/api/admin/me', { headers: auth() });
  assert.equal(user.status, 403);

  const admin = await request('/api/admin/me', {
    headers: auth('demo-admin-token'),
  });
  assert.equal(admin.status, 200);
  const body = await admin.json();
  assert.equal(body.data.role, 'hospital_admin');
});

test('health records are paginated, archivable, and owner-scoped', async () => {
  const unauth = await request('/api/health-tracker/history');
  assert.equal(unauth.status, 401);

  const createdIds = [];
  for (const title of ['Condition one', 'Condition two', 'Condition three']) {
    const response = await request('/api/health-tracker/history', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ category: 'Condition', title }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    createdIds.push(String(body.data._id));
  }

  const page = await request('/api/health-tracker/history?limit=1&offset=1', {
    headers: auth(),
  });
  assert.equal(page.status, 200);
  const pageBody = await page.json();
  assert.equal(pageBody.data.items.length, 1);
  assert.equal(pageBody.data.pagination.total, 3);
  assert.equal(pageBody.data.pagination.hasMore, true);

  const archive = await request(
    `/api/health-tracker/history/${createdIds[0]}/archive`,
    { method: 'POST', headers: auth() }
  );
  assert.equal(archive.status, 200);
  const archiveBody = await archive.json();
  assert.ok(archiveBody.data.archivedAt);

  const active = await request('/api/health-tracker/history', {
    headers: auth(),
  });
  const activeBody = await active.json();
  assert.equal(activeBody.data.pagination.total, 2);

  const all = await request(
    '/api/health-tracker/history?includeArchived=true',
    { headers: auth() }
  );
  const allBody = await all.json();
  assert.equal(allBody.data.pagination.total, 3);

  const unarchive = await request(
    `/api/health-tracker/history/${createdIds[0]}/unarchive`,
    { method: 'POST', headers: auth() }
  );
  assert.equal(unarchive.status, 200);
  const unarchiveBody = await unarchive.json();
  assert.equal(unarchiveBody.data.archivedAt, null);

  const otherOwner = await request('/api/health-tracker/history', {
    headers: auth('demo-admin-token'),
  });
  assert.equal(otherOwner.status, 200);
  const otherOwnerBody = await otherOwner.json();
  assert.equal(otherOwnerBody.data.pagination.total, 0);
});

test('invalid bearer tokens cannot access owner records', async () => {
  const response = await request('/api/health-tracker/history', {
    headers: auth('attacker-forged-token'),
  });
  assert.notEqual(response.status, 200);
  assert.ok([401, 503].includes(response.status));
});
