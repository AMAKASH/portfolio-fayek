import { Router } from 'express';
import mongoose from 'mongoose';
import { dbReady } from '../../config/db.js';

export const healthRoutes = Router();

/** Liveness + readiness: 200 only when MongoDB is connected. */
healthRoutes.get('/', async (_req, res) => {
  let db = dbReady();
  if (db) {
    try {
      await mongoose.connection.db!.admin().ping();
    } catch {
      db = false;
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) });
});
