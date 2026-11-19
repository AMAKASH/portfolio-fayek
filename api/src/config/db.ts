import mongoose from 'mongoose';
import { env, isProd } from './env.js';
import { logger } from '../lib/logger.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = env.MONGODB_URI): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, {
    maxPoolSize: env.MONGO_MAX_POOL,
    serverSelectionTimeoutMS: 10_000,
    // Index builds are expensive; in production run `npm run db:indexes` instead (or MONGO_AUTO_INDEX=true).
    autoIndex: env.MONGO_AUTO_INDEX || !isProd,
  });
  logger.info({ host: conn.connection.host, db: conn.connection.name }, 'MongoDB connected');
  return conn;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}
