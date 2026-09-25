import express from 'express';
import { databaseMode } from '../config/db.js';
import { HealthProfile } from '../models/HealthProfile.js';
import { memoryProfiles } from './healthTrackerRoutes.js';

const router = express.Router();
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export function publicEmergencyProfile(emergency) {
  if (!emergency?.enabled) return null;
  const share = emergency.share || {}, result = {};
  if (share.name && emergency.displayName) result.displayName = emergency.displayName;
  if (share.bloodGroup) result.bloodGroup = emergency.bloodGroup || 'Blood group not provided';
  if (share.allergies && emergency.allergies?.length) result.allergies = [...emergency.allergies];
  if (share.conditions && emergency.criticalConditions?.length) result.criticalConditions = [...emergency.criticalConditions];
  if (share.medicines && emergency.importantMedicines?.length) result.importantMedicines = [...emergency.importantMedicines];
  if (share.emergencyContact && emergency.emergencyContact?.phone) result.emergencyContact = { name: emergency.emergencyContact.name || undefined, relationship: emergency.emergencyContact.relationship || undefined, phone: emergency.emergencyContact.phone };
  return result;
}

router.get('/:token', async (req, res) => {
  try {
    if (!validToken(req.params.token)) return res.status(404).json({ success: false, message: 'This Emergency QR is invalid or no longer active.' });
    let emergency;
    if (databaseMode === 'mongo') emergency = (await HealthProfile.findOne({ 'emergencyProfile.publicToken': req.params.token }).select('+emergencyProfile.publicToken emergencyProfile'))?.emergencyProfile;
    else emergency = [...memoryProfiles.values()].find(profile => profile.emergencyProfile?.publicToken === req.params.token)?.emergencyProfile;
    const safe = publicEmergencyProfile(emergency);
    if (!safe) return res.status(404).json({ success: false, message: 'This Emergency QR is invalid or no longer active.' });
    res.json({ success: true, data: safe });
  } catch {
    res.status(404).json({ success: false, message: 'This Emergency QR is invalid or no longer active.' });
  }
});
export default router;
