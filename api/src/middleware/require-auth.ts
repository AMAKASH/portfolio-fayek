import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';
import { verifyAccess } from '../modules/auth/auth.service.js';

/** Requires `Authorization: Bearer <access token>`. Stateless — no DB hit per request. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(HttpError.unauthorized('Missing access token'));
  const payload = verifyAccess(header.slice(7));
  req.auth = { userId: payload.sub, email: payload.email };
  next();
};
