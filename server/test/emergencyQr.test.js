import assert from 'node:assert/strict';
import test from 'node:test';
import { publicEmergencyProfile } from '../src/routes/emergencyRoutes.js';
import { generateEmergencyToken } from '../src/routes/healthTrackerRoutes.js';

test('public emergency response contains only explicitly shared fields', () => {
  const result = publicEmergencyProfile({ enabled: true, publicToken: 'secret', ownerKey: 'private-user', displayName: 'Rahul', bloodGroup: 'B+', allergies: ['Penicillin'], importantMedicines: ['Metformin'], criticalConditions: ['Diabetes'], emergencyContact: { name: 'Maya', relationship: 'Mother', phone: '12345' }, share: { name: false, bloodGroup: true, allergies: true, medicines: true, conditions: false, emergencyContact: true }, womensHealth: { cycles: ['private'] }, email: 'private@example.com' });
  assert.deepEqual(result, { bloodGroup: 'B+', allergies: ['Penicillin'], importantMedicines: ['Metformin'], emergencyContact: { name: 'Maya', relationship: 'Mother', phone: '12345' } });
  for (const forbidden of ['publicToken', 'ownerKey', 'displayName', 'criticalConditions', 'womensHealth', 'email']) assert.equal(forbidden in result, false);
});

test('disabled emergency profiles produce no public response', () => assert.equal(publicEmergencyProfile({ enabled: false, share: {} }), null));

test('emergency tokens are cryptographically random URL-safe 256-bit values', () => {
  const first = generateEmergencyToken(), second = generateEmergencyToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/); assert.match(second, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(first, second);
});
