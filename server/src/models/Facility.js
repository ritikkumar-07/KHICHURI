import { Schema, model } from 'mongoose';
export const Facility = model('Facility', new Schema({ name: String, type: String, coordinates: { lat: Number, lng: Number }, icuBeds: Number, emergency: Boolean, bloodInventory: { OPlus: Number, OMinus: Number, APlus: Number, BPlus: Number }, address: String, phone: String }));
