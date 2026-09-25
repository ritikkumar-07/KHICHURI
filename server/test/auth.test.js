import assert from 'node:assert/strict';
import test from 'node:test';
import { requireHospitalAdmin } from '../src/middleware/auth.js';

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('normal users are denied hospital admin access', () => {
  const res = response(); let continued = false;
  requireHospitalAdmin({ user: { app_metadata: { role: 'user' } } }, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, 'Hospital administrator access required.');
});

test('missing roles are treated as normal users and denied admin access', () => {
  const res = response(); let continued = false;
  requireHospitalAdmin({ user: { app_metadata: {} } }, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 403);
});

test('trusted hospital_admin metadata permits admin access', () => {
  const res = response(); let continued = false;
  requireHospitalAdmin({ user: { app_metadata: { role: 'hospital_admin' } } }, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(res.statusCode, 200);
});
