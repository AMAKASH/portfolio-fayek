import { rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env.js';

const json = (message: string) => ({ error: { message, code: 'RATE_LIMITED' } });

/** Brute-force protection for login. */
export const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: isTest ? 1000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: json('Too many login attempts, try again in a minute'),
});

/** General ceiling for the API. Generous; protects against accidental loops/scrapers. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: isTest ? 100_000 : 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many requests'),
});
