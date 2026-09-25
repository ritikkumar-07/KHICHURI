import { Schema, model } from 'mongoose';
export const FirstAid = model('FirstAid', new Schema({ title: String, category: String, urgency: String, steps: [String], warning: String }));
