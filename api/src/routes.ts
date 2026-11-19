import { Router } from 'express';
import { noStore } from './middleware/cache-headers.js';
import { requireAuth } from './middleware/require-auth.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { adminMediaRoutes } from './modules/media/media.routes.js';
import { adminProjectRoutes, publicProjectRoutes } from './modules/projects/project.routes.js';

/**
 * API v1. To add a module: create src/modules/<name>/{model,schema,service,controller,routes}.ts
 * and mount its router(s) here — public routers directly, admin routers under `admin`.
 */
export const v1 = Router();

v1.use('/auth', noStore, authRoutes);
v1.use('/projects', publicProjectRoutes);

const admin = Router();
admin.use(noStore, requireAuth);
admin.use('/projects', adminProjectRoutes);
admin.use('/media', adminMediaRoutes);
v1.use('/admin', admin);
