import { Schema, model } from 'mongoose';

const metricSchema = new Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  unit: { type: String, default: '' },
  inputType: { type: String, enum: ['number', 'scale', 'boolean'], required: true },
  direction: { type: String, enum: ['higher', 'lower', 'neutral'], required: true },
  min: Number,
  max: Number,
  baseline: Schema.Types.Mixed
}, { _id: false });

const checkInSchema = new Schema({
  date: { type: Date, required: true },
  values: { type: Map, of: Schema.Types.Mixed, default: {} },
  notes: { type: String, default: '', maxlength: 2000 },
  opi: { type: Number, min: 0, max: 100 }
}, { timestamps: true });

const milestoneSchema = new Schema({
  title: { type: String, required: true, maxlength: 160 },
  date: { type: Date, required: true },
  note: { type: String, default: '', maxlength: 1000 },
  status: { type: String, enum: ['Completed', 'In Progress', 'Upcoming'], required: true }
}, { timestamps: true });

const planSchema = new Schema({
  type: { type: String, enum: ['Post-Surgery Recovery', 'Illness Recovery', 'Injury Recovery', 'Chronic Condition', 'General Health', 'Custom'], required: true },
  title: { type: String, required: true, maxlength: 160 },
  conditionName: { type: String, required: true, maxlength: 160 },
  startDate: { type: Date, required: true },
  description: { type: String, default: '', maxlength: 2000 },
  hospital: { type: String, default: '', maxlength: 160 },
  doctor: { type: String, default: '', maxlength: 160 },
  goal: { type: String, required: true, maxlength: 500 },
  targetDate: Date,
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  completedAt: Date,
  metrics: { type: [metricSchema], validate: value => value.length > 0 },
  checkIns: [checkInSchema],
  milestones: [milestoneSchema]
}, { timestamps: true });

const medicineReminderSchema = new Schema({
  frequency: { type: String, enum: ['Once Daily', 'Twice Daily', 'Three Times Daily', 'Custom Time'], required: true },
  times: [{ type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }],
  startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  endDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  enabled: { type: Boolean, default: true },
  taken: [{ date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ } }]
}, { _id: false });

const historySchema = new Schema({
  patientProfileId: { type: String, default: '', maxlength: 80, index: true },
  category: { type: String, enum: ['Condition', 'Surgery', 'Illness', 'Allergy', 'Medicine'], required: true },
  title: { type: String, required: true, maxlength: 160 },
  startDate: Date,
  endDate: Date,
  status: { type: String, default: '', maxlength: 80 },
  details: { type: String, default: '', maxlength: 2000 },
  hospital: { type: String, default: '', maxlength: 160 },
  doctor: { type: String, default: '', maxlength: 160 },
  dose: { type: String, default: '', maxlength: 100 },
  frequency: { type: String, default: '', maxlength: 100 },
  reaction: { type: String, default: '', maxlength: 500 },
  medicineSourceId: { type: String, default: '', maxlength: 100 },
  medicineSource: { type: String, default: '', maxlength: 100 },
  formStrength: { type: String, default: '', maxlength: 160 },
  purpose: { type: String, default: '', maxlength: 500 },
  prescribedBy: { type: String, default: '', maxlength: 160 },
  reminder: { type: medicineReminderSchema, default: undefined },
  associatedPlanId: String
}, { timestamps: true });

const careCircleMemberSchema = new Schema({
  name: { type: String, required: true, maxlength: 100 },
  relationship: { type: String, enum: ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Sister', 'Brother', 'Spouse', 'Child', 'Other'], required: true },
  age: { type: Number, min: 0, max: 130 },
  bloodGroup: { type: String, enum: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'], default: '' },
  allergy: { type: String, default: '', maxlength: 300 },
  emergencyContact: { type: String, default: '', maxlength: 40 }
}, { timestamps: true });

const cycleRecordSchema = new Schema({
  startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  endDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  notes: { type: String, default: '', maxlength: 2000 }
}, { timestamps: true });

const cycleLogSchema = new Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  flow: { type: String, enum: ['', 'No period', 'Spotting', 'Light', 'Medium', 'Heavy'], default: '' },
  pain: { type: Number, min: 0, max: 10 },
  painAreas: [{ type: String, maxlength: 60 }],
  symptoms: [{ type: String, maxlength: 80 }],
  mood: { type: String, enum: ['', 'Very low', 'Low', 'Neutral', 'Good', 'Very good'], default: '' },
  energy: { type: String, enum: ['', 'Very low', 'Low', 'Normal', 'High', 'Very high'], default: '' },
  sleepHours: { type: Number, min: 0, max: 24 },
  sleepQuality: { type: Number, min: 0, max: 10 },
  discharge: { type: String, default: '', maxlength: 160 },
  notes: { type: String, default: '', maxlength: 2000 },
  medicineIds: [{ type: String, maxlength: 80 }]
}, { timestamps: true });

const womenConditionSchema = new Schema({
  title: { type: String, required: true, maxlength: 160 },
  diagnosedDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  doctor: { type: String, default: '', maxlength: 160 },
  hospital: { type: String, default: '', maxlength: 160 },
  status: { type: String, default: '', maxlength: 80 },
  notes: { type: String, default: '', maxlength: 2000 },
  associatedPlanId: String
}, { timestamps: true });

const womenAppointmentSchema = new Schema({
  title: { type: String, required: true, maxlength: 160 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  doctor: { type: String, default: '', maxlength: 160 },
  hospital: { type: String, default: '', maxlength: 160 },
  notes: { type: String, default: '', maxlength: 2000 }
}, { timestamps: true });

const womenHealthSchema = new Schema({
  setupComplete: { type: Boolean, default: false },
  typicalCycleLength: { type: Number, min: 15, max: 90 },
  typicalPeriodDuration: { type: Number, min: 1, max: 30 },
  regularity: { type: String, enum: ['', 'Usually regular', 'Sometimes irregular', 'Very irregular', 'Not sure'], default: '' },
  goals: [{ type: String, maxlength: 80 }],
  fertilityEstimates: { type: Boolean, default: false },
  predictionsPaused: { type: Boolean, default: false },
  trackMood: { type: Boolean, default: true },
  trackEnergy: { type: Boolean, default: true },
  trackDischarge: { type: Boolean, default: false },
  cycles: [cycleRecordSchema],
  dailyLogs: [cycleLogSchema],
  conditions: [womenConditionSchema],
  appointments: [womenAppointmentSchema]
}, { _id: false });

const emergencyProfileSchema = new Schema({
  enabled: { type: Boolean, default: false },
  publicToken: { type: String, index: true, sparse: true, unique: true, select: false },
  displayName: { type: String, default: '', maxlength: 100 },
  bloodGroup: { type: String, enum: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'], default: '' },
  allergies: [{ type: String, maxlength: 160 }],
  importantMedicines: [{ type: String, maxlength: 160 }],
  criticalConditions: [{ type: String, maxlength: 160 }],
  emergencyContact: {
    name: { type: String, default: '', maxlength: 100 },
    relationship: { type: String, default: '', maxlength: 60 },
    phone: { type: String, default: '', maxlength: 30 }
  },
  share: {
    name: { type: Boolean, default: false },
    bloodGroup: { type: Boolean, default: true },
    allergies: { type: Boolean, default: true },
    medicines: { type: Boolean, default: false },
    conditions: { type: Boolean, default: false },
    emergencyContact: { type: Boolean, default: true }
  }
}, { _id: false, timestamps: true });

const healthProfileSchema = new Schema({
  ownerKey: { type: String, required: true, unique: true, index: true },
  plans: [planSchema],
  history: [historySchema],
  careCircle: [careCircleMemberSchema],
  womensHealth: { type: womenHealthSchema, default: () => ({}) },
  emergencyProfile: { type: emergencyProfileSchema, default: undefined }
}, { timestamps: true });

export const HealthProfile = model('HealthProfile', healthProfileSchema);
