import { Schema, model } from 'mongoose';
export const SosAlert = model('SosAlert', new Schema({ coordinates: { lat: Number, lng: Number }, timestamp: Date, urgency: String, conditionSummary: String, status: String, acknowledgedAt: Date }));
