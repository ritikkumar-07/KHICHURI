import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';

import { env } from '../config/env.js';
import { connectDb, isMongoConnected } from '../config/db.js';
import { Facility } from '../models/Facility.js';
import { FirstAid } from '../models/FirstAid.js';
import { HealthProfile } from '../models/HealthProfile.js';
import { SosAlert } from '../models/SosAlert.js';

const models = {
  Facility,
  FirstAid,
  HealthProfile,
  SosAlert,
};

export async function ensureIndexes() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is required to create database indexes.');
  }

  await connectDb();
  if (!isMongoConnected()) {
    throw new Error('MongoDB is not connected; indexes were not created.');
  }

  for (const [name, model] of Object.entries(models)) {
    await model.createIndexes();
    console.log(`[db:indexes] ${name} indexes ensured`);
  }
}

const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  ensureIndexes()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(`[db:indexes] ${error.message}`);
      try {
        await mongoose.disconnect();
      } catch {
        // Ignore disconnect failures during error cleanup.
      }
      process.exit(1);
    });
}
