import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessSosAlert,
  isHospitalAdmin,
} from '../src/middleware/auth.js';
import {
  createSos,
  publicSosAlert,
} from '../src/sockets/emergencySocket.js';
import {
  getFallbackTriage,
  normalizeLanguage,
} from '../src/services/aiDispatcher.js';

test('anonymous SOS responses use an unguessable capability token', async () => {
  const alert = await createSos({
    latitude: 22.57,
    longitude: 88.36,
    urgency: 'RED',
    conditionSummary: 'Private test',
  });

  assert.match(alert.id, /^SOS-[0-9a-f-]{36}$/);
  assert.match(alert.accessToken, /^[A-Za-z0-9_-]{40,}$/);

  const publicAlert = publicSosAlert(alert);
  assert.equal(publicAlert.accessToken, undefined);
  assert.equal(publicAlert.ownerId, undefined);
  assert.equal(canAccessSosAlert(alert, null), false);
  assert.equal(canAccessSosAlert(alert, null, 'wrong-token'), false);
  assert.equal(
    canAccessSosAlert(alert, null, alert.accessToken),
    true
  );
});

test('SOS owner and hospital admins can access authenticated alerts', () => {
  const alert = { ownerId: 'user-1', accessToken: null };
  assert.equal(canAccessSosAlert(alert, null), false);
  assert.equal(canAccessSosAlert(alert, { id: 'user-1' }), true);
  assert.equal(canAccessSosAlert(alert, { id: 'user-2' }), false);
  assert.equal(
    canAccessSosAlert(alert, {
      id: 'admin-1',
      app_metadata: { role: 'hospital_admin' },
    }),
    true
  );
});

test('admin checks ignore user-controlled metadata', () => {
  assert.equal(
    isHospitalAdmin({
      id: 'attacker',
      app_metadata: { role: 'user' },
      user_metadata: { role: 'hospital_admin' },
    }),
    false
  );
});

test('language aliases and red-flag fallback are deterministic', () => {
  assert.equal(normalizeLanguage('bn-IN'), 'Bengali');
  assert.equal(normalizeLanguage('hi'), 'Hindi');
  assert.equal(normalizeLanguage('unknown'), 'English');

  const triage = getFallbackTriage(
    'English',
    'Severe chest pain and difficulty breathing'
  );
  assert.equal(triage.alertLevel, 'RED');
  assert.equal(triage.isFinalVerdict, true);
});
