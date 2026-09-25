import { randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { databaseMode } from '../config/db.js';
import { HealthProfile } from '../models/HealthProfile.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
export const memoryProfiles = new Map();
const allowedTypes = new Set(['Post-Surgery Recovery', 'Illness Recovery', 'Injury Recovery', 'Chronic Condition', 'General Health', 'Custom']);
const allowedInputs = new Set(['number', 'scale', 'boolean']);
const allowedDirections = new Set(['higher', 'lower', 'neutral']);
const allowedHistory = new Set(['Condition', 'Surgery', 'Illness', 'Allergy', 'Medicine']);
const allowedMilestones = new Set(['Completed', 'In Progress', 'Upcoming']);
const allowedRelationships = new Set(['Mother', 'Father', 'Grandmother', 'Grandfather', 'Sister', 'Brother', 'Spouse', 'Child', 'Other']);
const allowedBloodGroups = new Set(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']);

const clean = (value, max = 2000) => typeof value === 'string' ? value.replace(/[<>]/g, '').trim().slice(0, max) : '';
const validDate = value => value && !Number.isNaN(new Date(value).getTime());
const blankWomenHealth = () => ({ setupComplete: false, regularity: '', goals: [], fertilityEstimates: false, predictionsPaused: false, trackMood: true, trackEnergy: true, trackDischarge: false, cycles: [], dailyLogs: [], conditions: [], appointments: [] });
const blankProfile = key => ({ ownerKey: key, plans: [], history: [], careCircle: [], womensHealth: blankWomenHealth() });
const json = value => value?.toObject ? value.toObject() : structuredClone(value);

export async function loadProfile(key) {
  if (databaseMode === 'mongo') return HealthProfile.findOneAndUpdate({ ownerKey: key }, { $setOnInsert: { ownerKey: key } }, { new: true, upsert: true });
  if (!memoryProfiles.has(key)) memoryProfiles.set(key, blankProfile(key));
  return memoryProfiles.get(key);
}

export async function saveProfile(profile) {
  if (databaseMode === 'mongo') return profile.save();
  memoryProfiles.set(profile.ownerKey, profile);
  return profile;
}

function metricValue(metric, value) {
  if (metric.inputType === 'boolean') return value === true || value === 'true';
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (Number.isFinite(metric.min) && number < metric.min) return null;
  if (Number.isFinite(metric.max) && number > metric.max) return null;
  return number;
}

function calculateOpi(metrics, values) {
  const scores = metrics.flatMap(metric => {
    if (metric.direction === 'neutral' || metric.baseline === undefined || metric.baseline === null) return [];
    const current = metricValue(metric, values[metric.key]);
    const baseline = metricValue(metric, metric.baseline);
    if (current === null || baseline === null) return [];
    if (metric.inputType === 'boolean') return [current === baseline ? 50 : current ? 100 : 0];
    const span = Number(metric.max) - Number(metric.min);
    if (!(span > 0)) return [];
    const delta = metric.direction === 'higher' ? current - baseline : baseline - current;
    return [Math.max(0, Math.min(100, 50 + (delta / span) * 50))];
  });
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
}

function findItem(items, id) {
  return items.find(item => String(item._id || item.id) === id);
}

const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const localToday = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const womenData = profile => {
  if (!profile.womensHealth) profile.womensHealth = blankWomenHealth();
  return profile.womensHealth;
};
const makeId = () => databaseMode === 'mongo' ? new mongoose.Types.ObjectId() : randomUUID();
const cleanList = (value, maxItems = 20, maxLength = 80) => Array.isArray(value) ? [...new Set(value.map(item => clean(item, maxLength)).filter(Boolean))].slice(0, maxItems) : [];

router.use(requireAuth, (req, res, next) => {
  req.ownerKey = req.user.id;
  next();
});

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: json(await loadProfile(req.ownerKey)) }); } catch (error) { next(error); }
});

const cleanEmergencyList = value => cleanList(value, 12, 160);
const cleanEmergencyProfile = body => ({
  enabled: body.enabled === true,
  displayName: clean(body.displayName, 100),
  bloodGroup: allowedBloodGroups.has(clean(body.bloodGroup, 10)) ? clean(body.bloodGroup, 10) : '',
  allergies: cleanEmergencyList(body.allergies),
  importantMedicines: cleanEmergencyList(body.importantMedicines),
  criticalConditions: cleanEmergencyList(body.criticalConditions),
  emergencyContact: { name: clean(body.emergencyContact?.name, 100), relationship: clean(body.emergencyContact?.relationship, 60), phone: clean(body.emergencyContact?.phone, 30) },
  share: { name: body.share?.name === true, bloodGroup: body.share?.bloodGroup === true, allergies: body.share?.allergies === true, medicines: body.share?.medicines === true, conditions: body.share?.conditions === true, emergencyContact: body.share?.emergencyContact === true }
});
export const generateEmergencyToken = () => randomBytes(32).toString('base64url');
const loadEmergencyOwnerProfile = key => databaseMode === 'mongo'
  ? HealthProfile.findOneAndUpdate({ ownerKey: key }, { $setOnInsert: { ownerKey: key } }, { new: true, upsert: true }).select('+emergencyProfile.publicToken')
  : loadProfile(key);

router.get('/emergency-profile', async (req, res, next) => {
  try {
    const profile = await loadEmergencyOwnerProfile(req.ownerKey), emergency = profile.emergencyProfile?.toObject?.() || profile.emergencyProfile || null, token = emergency?.publicToken;
    const medicines = (profile.history || []).filter(item => item.category === 'Medicine' && !item.patientProfileId && item.status?.toLowerCase() !== 'previous').map(item => item.title);
    res.json({ success: true, data: { profile: emergency ? { ...emergency, publicToken: undefined, hasToken: Boolean(token) } : null, token, medicines } });
  } catch (error) { next(error); }
});

router.put('/emergency-profile', async (req, res, next) => {
  try {
    const profile = await loadEmergencyOwnerProfile(req.ownerKey), currentToken = profile.emergencyProfile?.publicToken;
    profile.emergencyProfile = { ...cleanEmergencyProfile(req.body || {}), publicToken: currentToken || generateEmergencyToken() };
    await saveProfile(profile);
    res.json({ success: true, data: { enabled: profile.emergencyProfile.enabled, hasToken: true, token: profile.emergencyProfile.publicToken } });
  } catch (error) {
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Please check the Emergency Profile fields and try again.' });
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'A secure QR could not be created. Please try generating it again.' });
    next(error);
  }
});

router.post('/emergency-profile/regenerate', async (req, res, next) => {
  try {
    const profile = await loadEmergencyOwnerProfile(req.ownerKey);
    if (!profile.emergencyProfile) return res.status(400).json({ success: false, message: 'Create your Emergency Profile first.' });
    profile.emergencyProfile.publicToken = generateEmergencyToken(); profile.emergencyProfile.enabled = true;
    await saveProfile(profile); res.json({ success: true, data: { enabled: true, hasToken: true, token: profile.emergencyProfile.publicToken } });
  } catch (error) { next(error); }
});

router.post('/emergency-profile/disable', async (req, res, next) => {
  try {
    const profile = await loadEmergencyOwnerProfile(req.ownerKey);
    if (profile.emergencyProfile) { profile.emergencyProfile.enabled = false; await saveProfile(profile); }
    res.json({ success: true, data: { enabled: false } });
  } catch (error) { next(error); }
});

router.post('/care-circle', async (req, res, next) => {
  try {
    const body = req.body || {}, name = clean(body.name, 100), relationship = clean(body.relationship, 30), age = body.age === '' || body.age === undefined ? undefined : Number(body.age), bloodGroup = clean(body.bloodGroup, 10);
    if (!name || !allowedRelationships.has(relationship) || (age !== undefined && (!Number.isInteger(age) || age < 0 || age > 130)) || !allowedBloodGroups.has(bloodGroup)) return res.status(400).json({ success: false, message: 'Enter a valid name, relationship, age, and blood group.' });
    const profile = await loadProfile(req.ownerKey), member = { _id: makeId(), name, relationship, age, bloodGroup, allergy: clean(body.allergy, 300), emergencyContact: clean(body.emergencyContact, 40), createdAt: new Date(), updatedAt: new Date() };
    if (!profile.careCircle) profile.careCircle = [];
    profile.careCircle.push(member); await saveProfile(profile); res.status(201).json({ success: true, data: json(findItem(profile.careCircle, String(member._id))) });
  } catch (error) { next(error); }
});

router.patch('/care-circle/:memberId', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.ownerKey), member = findItem(profile.careCircle || [], req.params.memberId);
    if (!member) return res.status(404).json({ success: false, message: 'Care Circle member not found.' });
    const body = req.body || {}, name = body.name === undefined ? member.name : clean(body.name, 100), relationship = body.relationship === undefined ? member.relationship : clean(body.relationship, 30), age = body.age === '' ? undefined : body.age === undefined ? member.age : Number(body.age), bloodGroup = body.bloodGroup === undefined ? member.bloodGroup : clean(body.bloodGroup, 10);
    if (!name || !allowedRelationships.has(relationship) || (age !== undefined && (!Number.isInteger(age) || age < 0 || age > 130)) || !allowedBloodGroups.has(bloodGroup)) return res.status(400).json({ success: false, message: 'Enter valid family member details.' });
    Object.assign(member, { name, relationship, age, bloodGroup });
    if (body.allergy !== undefined) member.allergy = clean(body.allergy, 300);
    if (body.emergencyContact !== undefined) member.emergencyContact = clean(body.emergencyContact, 40);
    await saveProfile(profile); res.json({ success: true, data: json(member) });
  } catch (error) { next(error); }
});

router.delete('/care-circle/:memberId', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.ownerKey), members = profile.careCircle || [], index = members.findIndex(item => String(item._id || item.id) === req.params.memberId);
    if (index < 0) return res.status(404).json({ success: false, message: 'Care Circle member not found.' });
    if (profile.history.some(item => item.patientProfileId === req.params.memberId)) return res.status(409).json({ success: false, message: 'Remove this member’s medicines and health conditions before removing their profile.' });
    members.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.memberId } });
  } catch (error) { next(error); }
});

router.post('/plans', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!allowedTypes.has(body.type) || !clean(body.title, 160) || !clean(body.conditionName, 160) || !validDate(body.startDate) || !clean(body.goal, 500)) return res.status(400).json({ success: false, message: 'Complete all required tracking details.' });
    if (!Array.isArray(body.metrics) || !body.metrics.length || body.metrics.length > 20) return res.status(400).json({ success: false, message: 'Choose at least one valid metric.' });
    const keys = new Set();
    const metrics = body.metrics.map((metric, index) => {
      const key = clean(metric.key, 60).replace(/[^a-zA-Z0-9_-]/g, '') || `metric-${index}`;
      if (keys.has(key) || !allowedInputs.has(metric.inputType) || !allowedDirections.has(metric.direction)) throw new Error('INVALID_METRICS');
      keys.add(key);
      const normalized = { key, label: clean(metric.label, 100), unit: clean(metric.unit, 30), inputType: metric.inputType, direction: metric.direction, min: Number(metric.min), max: Number(metric.max) };
      normalized.baseline = metricValue(normalized, metric.baseline);
      if (!normalized.label || normalized.baseline === null || (normalized.inputType !== 'boolean' && !(normalized.max > normalized.min))) throw new Error('INVALID_METRICS');
      return normalized;
    });
    const profile = await loadProfile(req.ownerKey);
    const plan = { _id: databaseMode === 'mongo' ? new mongoose.Types.ObjectId() : randomUUID(), type: body.type, title: clean(body.title, 160), conditionName: clean(body.conditionName, 160), startDate: new Date(body.startDate), description: clean(body.description), hospital: clean(body.hospital, 160), doctor: clean(body.doctor, 160), goal: clean(body.goal, 500), targetDate: validDate(body.targetDate) ? new Date(body.targetDate) : undefined, status: 'active', metrics, checkIns: [], milestones: [], createdAt: new Date(), updatedAt: new Date() };
    profile.plans.push(plan); await saveProfile(profile);
    res.status(201).json({ success: true, data: json(findItem(profile.plans, String(plan._id))) });
  } catch (error) { if (error.message === 'INVALID_METRICS') return res.status(400).json({ success: false, message: 'One or more metrics are invalid.' }); next(error); }
});

router.patch('/plans/:planId', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.ownerKey), plan = findItem(profile.plans, req.params.planId);
    if (!plan) return res.status(404).json({ success: false, message: 'Tracking plan not found.' });
    if (req.body.status === 'completed') { plan.status = 'completed'; plan.completedAt = new Date(); }
    if (req.body.status === 'active') { plan.status = 'active'; plan.completedAt = undefined; }
    await saveProfile(profile); res.json({ success: true, data: json(plan) });
  } catch (error) { next(error); }
});

router.delete('/plans/:planId', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey); const index = profile.plans.findIndex(item => String(item._id || item.id) === req.params.planId); if (index < 0) return res.status(404).json({ success: false, message: 'Tracking plan not found.' }); profile.plans.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.planId } }); } catch (error) { next(error); }
});

router.post('/plans/:planId/check-ins', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.ownerKey), plan = findItem(profile.plans, req.params.planId);
    if (!plan || plan.status !== 'active') return res.status(404).json({ success: false, message: 'Active tracking plan not found.' });
    if (!validDate(req.body.date)) return res.status(400).json({ success: false, message: 'A valid check-in date is required.' });
    const values = {};
    for (const metric of plan.metrics) { const value = metricValue(metric, req.body.values?.[metric.key]); if (value !== null) values[metric.key] = value; }
    if (!Object.keys(values).length) return res.status(400).json({ success: false, message: 'Record at least one metric.' });
    const checkIn = { _id: databaseMode === 'mongo' ? new mongoose.Types.ObjectId() : randomUUID(), date: new Date(req.body.date), values, notes: clean(req.body.notes), opi: calculateOpi(plan.metrics, values), createdAt: new Date(), updatedAt: new Date() };
    plan.checkIns.push(checkIn); await saveProfile(profile); res.status(201).json({ success: true, data: json(findItem(plan.checkIns, String(checkIn._id))) });
  } catch (error) { next(error); }
});

router.delete('/plans/:planId/check-ins/:checkInId', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), plan = findItem(profile.plans, req.params.planId); if (!plan) return res.status(404).json({ success: false, message: 'Tracking plan not found.' }); const index = plan.checkIns.findIndex(item => String(item._id || item.id) === req.params.checkInId); if (index < 0) return res.status(404).json({ success: false, message: 'Check-in not found.' }); plan.checkIns.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.checkInId } }); } catch (error) { next(error); }
});

router.post('/plans/:planId/milestones', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), plan = findItem(profile.plans, req.params.planId); if (!plan) return res.status(404).json({ success: false, message: 'Tracking plan not found.' }); if (!clean(req.body.title, 160) || !validDate(req.body.date) || !allowedMilestones.has(req.body.status)) return res.status(400).json({ success: false, message: 'Complete the milestone details.' }); const item = { _id: databaseMode === 'mongo' ? new mongoose.Types.ObjectId() : randomUUID(), title: clean(req.body.title, 160), date: new Date(req.body.date), note: clean(req.body.note, 1000), status: req.body.status, createdAt: new Date(), updatedAt: new Date() }; plan.milestones.push(item); await saveProfile(profile); res.status(201).json({ success: true, data: json(findItem(plan.milestones, String(item._id))) }); } catch (error) { next(error); }
});

router.patch('/plans/:planId/milestones/:milestoneId', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), plan = findItem(profile.plans, req.params.planId), item = plan && findItem(plan.milestones, req.params.milestoneId); if (!item) return res.status(404).json({ success: false, message: 'Milestone not found.' }); if (req.body.title !== undefined) item.title = clean(req.body.title, 160); if (validDate(req.body.date)) item.date = new Date(req.body.date); if (req.body.note !== undefined) item.note = clean(req.body.note, 1000); if (allowedMilestones.has(req.body.status)) item.status = req.body.status; if (!item.title) return res.status(400).json({ success: false, message: 'Milestone title is required.' }); await saveProfile(profile); res.json({ success: true, data: json(item) }); } catch (error) { next(error); }
});

router.delete('/plans/:planId/milestones/:milestoneId', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), plan = findItem(profile.plans, req.params.planId); if (!plan) return res.status(404).json({ success: false, message: 'Tracking plan not found.' }); const index = plan.milestones.findIndex(item => String(item._id || item.id) === req.params.milestoneId); if (index < 0) return res.status(404).json({ success: false, message: 'Milestone not found.' }); plan.milestones.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.milestoneId } }); } catch (error) { next(error); }
});

router.post('/history', async (req, res, next) => {
  try { if (!allowedHistory.has(req.body.category) || !clean(req.body.title, 160)) return res.status(400).json({ success: false, message: 'Choose a category and enter a title.' }); const profile = await loadProfile(req.ownerKey), patientProfileId = clean(req.body.patientProfileId, 80); if (patientProfileId && !findItem(profile.careCircle || [], patientProfileId)) return res.status(400).json({ success: false, message: 'Choose a valid Care Circle member.' }); const item = { _id: databaseMode === 'mongo' ? new mongoose.Types.ObjectId() : randomUUID(), patientProfileId, category: req.body.category, title: clean(req.body.title, 160), startDate: validDate(req.body.startDate) ? new Date(req.body.startDate) : undefined, endDate: validDate(req.body.endDate) ? new Date(req.body.endDate) : undefined, status: clean(req.body.status, 80), details: clean(req.body.details), hospital: clean(req.body.hospital, 160), doctor: clean(req.body.doctor, 160), dose: clean(req.body.dose, 100), frequency: clean(req.body.frequency, 100), reaction: clean(req.body.reaction, 500), medicineSourceId: clean(req.body.medicineSourceId, 100), medicineSource: clean(req.body.medicineSource, 100), formStrength: clean(req.body.formStrength, 160), purpose: clean(req.body.purpose, 500), prescribedBy: clean(req.body.prescribedBy, 160), associatedPlanId: clean(req.body.associatedPlanId, 80), createdAt: new Date(), updatedAt: new Date() }; profile.history.push(item); await saveProfile(profile); res.status(201).json({ success: true, data: json(findItem(profile.history, String(item._id))) }); } catch (error) { next(error); }
});

router.patch('/history/:historyId', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), item = findItem(profile.history, req.params.historyId); if (!item) return res.status(404).json({ success: false, message: 'Medical history item not found.' }); for (const field of ['title', 'status', 'details', 'hospital', 'doctor', 'dose', 'frequency', 'reaction', 'formStrength', 'purpose', 'prescribedBy', 'associatedPlanId']) if (req.body[field] !== undefined) item[field] = clean(req.body[field], field === 'details' ? 2000 : 500); if (validDate(req.body.startDate)) item.startDate = new Date(req.body.startDate); if (validDate(req.body.endDate)) item.endDate = new Date(req.body.endDate); if (!item.title) return res.status(400).json({ success: false, message: 'A title is required.' }); await saveProfile(profile); res.json({ success: true, data: json(item) }); } catch (error) { next(error); }
});

router.delete('/history/:historyId', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey); const index = profile.history.findIndex(item => String(item._id || item.id) === req.params.historyId); if (index < 0) return res.status(404).json({ success: false, message: 'Medical history item not found.' }); profile.history.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.historyId } }); } catch (error) { next(error); }
});

router.put('/history/:historyId/reminder', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.ownerKey), item = findItem(profile.history, req.params.historyId), body = req.body || {};
    if (!item || item.category !== 'Medicine') return res.status(404).json({ success: false, message: 'Medicine record not found.' });
    const frequencies = { 'Once Daily': 1, 'Twice Daily': 2, 'Three Times Daily': 3, 'Custom Time': null };
    if (!(body.frequency in frequencies) || !Array.isArray(body.times)) return res.status(400).json({ success: false, message: 'Choose a valid reminder frequency and time.' });
    const times = [...new Set(body.times.map(value => clean(value, 5)))].sort();
    const expected = frequencies[body.frequency];
    if (!times.length || times.length > 8 || (expected && times.length !== expected) || times.some(value => !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) return res.status(400).json({ success: false, message: 'Enter the required valid reminder times.' });
    if (!dateOnly(body.startDate) || (body.endDate && (!dateOnly(body.endDate) || body.endDate < body.startDate))) return res.status(400).json({ success: false, message: 'Enter valid reminder dates.' });
    item.reminder = { frequency: body.frequency, times, startDate: body.startDate, endDate: body.endDate || undefined, enabled: body.enabled !== false, taken: item.reminder?.taken || [] };
    await saveProfile(profile); res.json({ success: true, data: json(item.reminder) });
  } catch (error) { next(error); }
});

router.delete('/history/:historyId/reminder', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), item = findItem(profile.history, req.params.historyId); if (!item || item.category !== 'Medicine') return res.status(404).json({ success: false, message: 'Medicine record not found.' }); item.reminder = undefined; await saveProfile(profile); res.json({ success: true, data: { id: req.params.historyId } }); } catch (error) { next(error); }
});

router.post('/history/:historyId/reminder/taken', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), item = findItem(profile.history, req.params.historyId); if (!item?.reminder || item.category !== 'Medicine') return res.status(404).json({ success: false, message: 'Medicine reminder not found.' }); if (!dateOnly(req.body.date) || !item.reminder.times.includes(req.body.time)) return res.status(400).json({ success: false, message: 'Choose a valid scheduled reminder.' }); const exists = item.reminder.taken.some(entry => entry.date === req.body.date && entry.time === req.body.time); if (!exists) item.reminder.taken.push({ date: req.body.date, time: req.body.time }); await saveProfile(profile); res.json({ success: true, data: json(item.reminder) }); } catch (error) { next(error); }
});

router.put('/womens-health/settings', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.ownerKey), data = womenData(profile), body = req.body || {};
    if (body.regularity !== undefined && !['', 'Usually regular', 'Sometimes irregular', 'Very irregular', 'Not sure'].includes(body.regularity)) return res.status(400).json({ success: false, message: 'Choose a valid cycle regularity.' });
    if (body.typicalCycleLength !== undefined && body.typicalCycleLength !== '' && !(Number(body.typicalCycleLength) >= 15 && Number(body.typicalCycleLength) <= 90)) return res.status(400).json({ success: false, message: 'Typical cycle length must be between 15 and 90 days.' });
    if (body.typicalPeriodDuration !== undefined && body.typicalPeriodDuration !== '' && !(Number(body.typicalPeriodDuration) >= 1 && Number(body.typicalPeriodDuration) <= 30)) return res.status(400).json({ success: false, message: 'Typical period duration must be between 1 and 30 days.' });
    for (const flag of ['setupComplete', 'fertilityEstimates', 'predictionsPaused', 'trackMood', 'trackEnergy', 'trackDischarge']) if (typeof body[flag] === 'boolean') data[flag] = body[flag];
    if (body.regularity !== undefined) data.regularity = body.regularity;
    if (body.goals !== undefined) data.goals = cleanList(body.goals, 10);
    if (body.typicalCycleLength !== undefined) data.typicalCycleLength = body.typicalCycleLength === '' ? undefined : Number(body.typicalCycleLength);
    if (body.typicalPeriodDuration !== undefined) data.typicalPeriodDuration = body.typicalPeriodDuration === '' ? undefined : Number(body.typicalPeriodDuration);
    await saveProfile(profile); res.json({ success: true, data: json(data) });
  } catch (error) { next(error); }
});

router.post('/womens-health/cycles', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.ownerKey), data = womenData(profile), body = req.body || {};
    if (!dateOnly(body.startDate) || (body.endDate && (!dateOnly(body.endDate) || body.endDate < body.startDate))) return res.status(400).json({ success: false, message: 'Enter valid period dates; the end date cannot be before the start date.' });
    if (body.startDate > localToday()) return res.status(400).json({ success: false, message: 'Confirmed periods cannot start in the future.' });
    if (data.cycles.some(item => item.startDate === body.startDate)) return res.status(409).json({ success: false, message: 'A period with this start date is already recorded.' });
    const item = { _id: makeId(), startDate: body.startDate, endDate: body.endDate || undefined, notes: clean(body.notes), createdAt: new Date(), updatedAt: new Date() };
    data.cycles.push(item); data.setupComplete = true; await saveProfile(profile); res.status(201).json({ success: true, data: json(findItem(data.cycles, String(item._id))) });
  } catch (error) { next(error); }
});

router.patch('/womens-health/cycles/:id', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), data = womenData(profile), item = findItem(data.cycles, req.params.id); if (!item) return res.status(404).json({ success: false, message: 'Cycle record not found.' }); const startDate = req.body.startDate ?? item.startDate, endDate = req.body.endDate ?? item.endDate; if (!dateOnly(startDate) || (endDate && (!dateOnly(endDate) || endDate < startDate)) || startDate > localToday()) return res.status(400).json({ success: false, message: 'Enter valid period dates.' }); if (data.cycles.some(other => other !== item && other.startDate === startDate)) return res.status(409).json({ success: false, message: 'A period with this start date already exists.' }); item.startDate = startDate; item.endDate = endDate || undefined; if (req.body.notes !== undefined) item.notes = clean(req.body.notes); await saveProfile(profile); res.json({ success: true, data: json(item) }); } catch (error) { next(error); }
});

router.delete('/womens-health/cycles/:id', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), items = womenData(profile).cycles, index = items.findIndex(item => String(item._id || item.id) === req.params.id); if (index < 0) return res.status(404).json({ success: false, message: 'Cycle record not found.' }); items.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.id } }); } catch (error) { next(error); }
});

router.post('/womens-health/logs', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.ownerKey), data = womenData(profile), body = req.body || {};
    if (!dateOnly(body.date)) return res.status(400).json({ success: false, message: 'Choose a valid log date.' });
    if (!['', 'No period', 'Spotting', 'Light', 'Medium', 'Heavy'].includes(body.flow || '')) return res.status(400).json({ success: false, message: 'Choose a valid flow entry.' });
    const pain = body.pain === '' || body.pain === undefined ? undefined : Number(body.pain), sleepHours = body.sleepHours === '' || body.sleepHours === undefined ? undefined : Number(body.sleepHours), sleepQuality = body.sleepQuality === '' || body.sleepQuality === undefined ? undefined : Number(body.sleepQuality);
    if ((pain !== undefined && !(pain >= 0 && pain <= 10)) || (sleepHours !== undefined && !(sleepHours >= 0 && sleepHours <= 24)) || (sleepQuality !== undefined && !(sleepQuality >= 0 && sleepQuality <= 10))) return res.status(400).json({ success: false, message: 'One or more daily values are outside the allowed range.' });
    let item = data.dailyLogs.find(log => log.date === body.date);
    const values = { flow: body.flow || '', pain, painAreas: cleanList(body.painAreas), symptoms: cleanList(body.symptoms), mood: clean(body.mood, 30), energy: clean(body.energy, 30), sleepHours, sleepQuality, discharge: clean(body.discharge, 160), notes: clean(body.notes), medicineIds: cleanList(body.medicineIds, 20), updatedAt: new Date() };
    if (item) Object.assign(item, values); else { item = { _id: makeId(), date: body.date, ...values, createdAt: new Date() }; data.dailyLogs.push(item); }
    await saveProfile(profile); res.status(201).json({ success: true, data: json(findItem(data.dailyLogs, String(item._id))) });
  } catch (error) { next(error); }
});

router.delete('/womens-health/logs/:id', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), items = womenData(profile).dailyLogs, index = items.findIndex(item => String(item._id || item.id) === req.params.id); if (index < 0) return res.status(404).json({ success: false, message: 'Daily log not found.' }); items.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.id } }); } catch (error) { next(error); }
});

router.post('/womens-health/conditions', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), data = womenData(profile), body = req.body || {}; if (!clean(body.title, 160) || (body.diagnosedDate && !dateOnly(body.diagnosedDate))) return res.status(400).json({ success: false, message: 'Enter a valid diagnosed condition.' }); const item = { _id: makeId(), title: clean(body.title, 160), diagnosedDate: body.diagnosedDate || undefined, doctor: clean(body.doctor, 160), hospital: clean(body.hospital, 160), status: clean(body.status, 80), notes: clean(body.notes), associatedPlanId: clean(body.associatedPlanId, 80), createdAt: new Date(), updatedAt: new Date() }; data.conditions.push(item); await saveProfile(profile); res.status(201).json({ success: true, data: json(findItem(data.conditions, String(item._id))) }); } catch (error) { next(error); }
});

router.patch('/womens-health/conditions/:id', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), item = findItem(womenData(profile).conditions, req.params.id); if (!item) return res.status(404).json({ success: false, message: 'Condition record not found.' }); for (const field of ['title', 'doctor', 'hospital', 'status', 'notes', 'associatedPlanId']) if (req.body[field] !== undefined) item[field] = clean(req.body[field], field === 'notes' ? 2000 : 160); if (req.body.diagnosedDate !== undefined) { if (req.body.diagnosedDate && !dateOnly(req.body.diagnosedDate)) return res.status(400).json({ success: false, message: 'Enter a valid diagnosed date.' }); item.diagnosedDate = req.body.diagnosedDate || undefined; } if (!item.title) return res.status(400).json({ success: false, message: 'Condition name is required.' }); await saveProfile(profile); res.json({ success: true, data: json(item) }); } catch (error) { next(error); }
});

router.delete('/womens-health/conditions/:id', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), items = womenData(profile).conditions, index = items.findIndex(item => String(item._id || item.id) === req.params.id); if (index < 0) return res.status(404).json({ success: false, message: 'Condition record not found.' }); items.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.id } }); } catch (error) { next(error); }
});

router.post('/womens-health/appointments', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), data = womenData(profile), body = req.body || {}; if (!clean(body.title, 160) || !dateOnly(body.date)) return res.status(400).json({ success: false, message: 'Enter a title and valid appointment date.' }); const item = { _id: makeId(), title: clean(body.title, 160), date: body.date, doctor: clean(body.doctor, 160), hospital: clean(body.hospital, 160), notes: clean(body.notes), createdAt: new Date(), updatedAt: new Date() }; data.appointments.push(item); await saveProfile(profile); res.status(201).json({ success: true, data: json(findItem(data.appointments, String(item._id))) }); } catch (error) { next(error); }
});

router.delete('/womens-health/appointments/:id', async (req, res, next) => {
  try { const profile = await loadProfile(req.ownerKey), items = womenData(profile).appointments, index = items.findIndex(item => String(item._id || item.id) === req.params.id); if (index < 0) return res.status(404).json({ success: false, message: 'Appointment not found.' }); items.splice(index, 1); await saveProfile(profile); res.json({ success: true, data: { id: req.params.id } }); } catch (error) { next(error); }
});

router.use((error, _req, res, _next) => { console.error('Health tracker request failed:', error.message); res.status(500).json({ success: false, message: 'The health record could not be saved.' }); });

export default router;
