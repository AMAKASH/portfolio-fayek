import { Router } from 'express';
import { publicCache } from '../../middleware/cache-headers.js';
import { validate } from '../../middleware/validate.js';
import * as c from './project.controller.js';
import {
  adminListQuery,
  idParams,
  projectInputSchema,
  projectPatchSchema,
  projectUpdateSchema,
  reorderSchema,
  slugAvailableQuery,
  slugParams,
} from './project.schema.js';

/** Mounted at /api/v1/projects — published content only, cacheable. */
export const publicProjectRoutes = Router();
publicProjectRoutes.use(publicCache);
publicProjectRoutes.get('/', c.list);
publicProjectRoutes.get('/featured', c.featured);
publicProjectRoutes.get('/:slug', validate({ params: slugParams }), c.bySlug);

/** Mounted at /api/v1/admin/projects — behind requireAuth. */
export const adminProjectRoutes = Router();
adminProjectRoutes.get('/', validate({ query: adminListQuery }), c.adminList);
adminProjectRoutes.get('/slug-available', validate({ query: slugAvailableQuery }), c.slugAvailable);
adminProjectRoutes.put('/reorder', validate({ body: reorderSchema }), c.reorder);
adminProjectRoutes.put('/featured/reorder', validate({ body: reorderSchema }), c.reorderFeatured);
adminProjectRoutes.post('/', validate({ body: projectInputSchema }), c.create);
adminProjectRoutes.get('/:id', validate({ params: idParams }), c.adminGet);
adminProjectRoutes.put('/:id', validate({ params: idParams, body: projectUpdateSchema }), c.update);
adminProjectRoutes.patch('/:id', validate({ params: idParams, body: projectPatchSchema }), c.patch);
adminProjectRoutes.delete('/:id', validate({ params: idParams }), c.remove);
adminProjectRoutes.post('/:id/duplicate', validate({ params: idParams }), c.duplicate);
