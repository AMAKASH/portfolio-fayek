import { Router } from 'express';
import { loginLimiter } from '../../middleware/rate-limit.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import * as c from './auth.controller.js';
import { changePasswordSchema, loginSchema } from './auth.schema.js';

export const authRoutes = Router();

authRoutes.post('/login', loginLimiter, validate({ body: loginSchema }), c.login);
authRoutes.post('/refresh', c.refresh);
authRoutes.post('/logout', c.logout);
authRoutes.get('/me', requireAuth, c.me);
authRoutes.patch('/password', requireAuth, validate({ body: changePasswordSchema }), c.changePassword);
