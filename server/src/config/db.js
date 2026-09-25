import mongoose from 'mongoose';
import { env } from './env.js';
export let databaseMode = 'memory';
export async function connectDb() { if (!env.mongoUri) {
    console.info('Database: in-memory demo mode');
    return;
} try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 4000 });
    databaseMode = 'mongo';
    console.info('Database: MongoDB connected');
}
catch (e) {
    console.warn('Database unavailable; using in-memory demo mode');
} }
