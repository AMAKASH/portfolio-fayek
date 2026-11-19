import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as c from './media.controller.js';
import { confirmSchema, mediaIdParams, mediaListQuery, mediaPatchSchema, presignSchema } from './media.schema.js';

/** Mounted at /api/v1/admin/media — behind requireAuth. */
export const adminMediaRoutes = Router();

adminMediaRoutes.get('/config', c.config);
adminMediaRoutes.post('/presign', validate({ body: presignSchema }), c.presign);
adminMediaRoutes.post('/', validate({ body: confirmSchema }), c.confirm);
adminMediaRoutes.get('/', validate({ query: mediaListQuery }), c.list);
adminMediaRoutes.patch('/:id', validate({ params: mediaIdParams, body: mediaPatchSchema }), c.patch);
adminMediaRoutes.delete('/:id', validate({ params: mediaIdParams }), c.remove);
