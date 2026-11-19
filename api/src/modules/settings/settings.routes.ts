import { Router } from 'express';
import { publicCache } from '../../middleware/cache-headers.js';
import { validate } from '../../middleware/validate.js';
import { settingsUpdateSchema } from './settings.schema.js';
import * as svc from './settings.service.js';

/** Mounted at /api/v1/settings — public, cacheable. */
export const publicSettingsRoutes = Router();
publicSettingsRoutes.get('/', publicCache, async (_req, res) => {
  res.json(await svc.getPublic());
});

/** Mounted at /api/v1/admin/settings — behind requireAuth. */
export const adminSettingsRoutes = Router();
adminSettingsRoutes.get('/', async (_req, res) => {
  res.json(await svc.getAdmin());
});
adminSettingsRoutes.put('/', validate({ body: settingsUpdateSchema }), async (req, res) => {
  res.json(await svc.update(req.body));
});
