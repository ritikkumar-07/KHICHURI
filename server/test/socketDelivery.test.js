import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { io as createSocket } from 'socket.io-client';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';

let http;
let io;
let baseUrl;

function waitForEvent(socket, event, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const handler = (payload) => {
      if (predicate && !predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

async function connectSocket(token) {
  const socket = createSocket(baseUrl, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 3000,
    auth: token ? { token } : {},
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
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

test('capability-token subscribers receive delivery state and unauthorized sockets do not', async () => {
  const response = await fetch(`${baseUrl}/api/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: 22.57,
      longitude: 88.36,
      urgency: 'RED',
      conditionSummary: 'Socket integration test',
    }),
  });
  assert.equal(response.status, 201);
  const alert = (await response.json()).data;

  const socket = await connectSocket('demo-admin-token');
  const other = await connectSocket();

  try {
    let unauthorizedReceived = false;
    other.on('sos:update', () => {
      unauthorizedReceived = true;
    });
    other.emit('sos:subscribe', { id: alert.id, token: 'wrong-token' });
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(unauthorizedReceived, false);

    const initialEvent = waitForEvent(
      socket,
      'sos:update',
      (payload) => payload.id === alert.id
    );
    socket.emit('sos:subscribe', {
      id: alert.id,
      token: alert.accessToken,
    });
    const initial = await initialEvent;
    assert.equal(initial.accessToken, undefined);
    assert.equal(initial.ownerId, undefined);
    assert.equal(initial.deliveryState, 'delivered');

    const deliveredEvent = waitForEvent(
      socket,
      'sos:update',
      (payload) =>
        payload.id === alert.id &&
        payload.deliveryState === 'acknowledged'
    );
    socket.emit('sos:delivery-ack', alert.id);
    const delivered = await deliveredEvent;

    assert.equal(delivered.deliveryState, 'acknowledged');
    assert.ok(delivered.version > initial.version);
    assert.equal(delivered.accessToken, undefined);
  } finally {
    socket.disconnect();
    other.disconnect();
  }
});
