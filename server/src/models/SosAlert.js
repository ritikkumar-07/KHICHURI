import { Schema, model } from 'mongoose';

const sosAlertSchema = new Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, default: null, index: true },
    coordinates: {
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },
    timestamp: { type: Date, required: true, index: true },
    urgency: {
      type: String,
      enum: ['RED', 'YELLOW', 'GREEN'],
      required: true,
    },
    conditionSummary: { type: String, default: '', maxlength: 500 },
    status: {
      type: String,
      enum: [
        'received',
        'dispatching',
        'en_route',
        'acknowledged',
        'resolved',
        'cancelled',
      ],
      default: 'received',
      index: true,
    },
    etaMinutes: { type: Number, min: 0, max: 240, default: 12 },
    accessToken: { type: String, default: null, index: true },
    acknowledgedAt: { type: Date, default: null },
    version: { type: Number, default: 1, min: 1 },
    deliveryState: {
      type: String,
      enum: ['pending', 'delivered', 'acknowledged'],
      default: 'pending',
      index: true,
    },
    deliveredAt: { type: Date, default: null },
    deliveryAckCount: { type: Number, default: 0, min: 0 },
    lastDeliveryAckAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sosAlertSchema.index({ status: 1, timestamp: -1 });
sosAlertSchema.index({ ownerId: 1, timestamp: -1 });
sosAlertSchema.index({ deliveryState: 1, timestamp: -1 });

export const SosAlert = model('SosAlert', sosAlertSchema);
