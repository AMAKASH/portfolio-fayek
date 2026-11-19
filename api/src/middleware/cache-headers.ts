import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

/** Public, CDN/browser cacheable responses. ETag (Express default) gives cheap 304 revalidation. */
export const publicCache: RequestHandler = (_req, res, next) => {
  const ttl = env.PUBLIC_CACHE_TTL_SECONDS;
  res.setHeader(
    'Cache-Control',
    ttl > 0 ? `public, max-age=${ttl}, stale-while-revalidate=${ttl * 5}` : 'no-cache',
  );
  next();
};

export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
