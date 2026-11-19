import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: { error: { message: string; code?: string; details?: unknown } } = {
    error: { message: 'Internal server error', code: 'INTERNAL' },
  };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: { message: err.message, code: err.code, details: err.details } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      error: {
        message: 'Validation failed',
        code: 'VALIDATION',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  } else if (err instanceof mongoose.Error.VersionError) {
    status = 409;
    body = {
      error: { message: 'This document was changed elsewhere. Reload and try again.', code: 'VERSION_CONFLICT' },
    };
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    body = {
      error: {
        message: 'Validation failed',
        code: 'VALIDATION',
        details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
      },
    };
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    body = { error: { message: `Invalid ${err.path}`, code: 'BAD_ID' } };
  } else if ((err as { code?: number })?.code === 11000) {
    status = 409;
    const key = Object.keys((err as { keyValue?: object }).keyValue ?? {})[0] ?? 'field';
    body = { error: { message: `${key} already exists`, code: 'DUPLICATE', details: { field: key } } };
  } else if ((err as { type?: string })?.type === 'entity.too.large') {
    status = 413;
    body = { error: { message: 'Request body too large', code: 'TOO_LARGE' } };
  } else if ((err as { type?: string })?.type === 'entity.parse.failed') {
    status = 400;
    body = { error: { message: 'Malformed JSON', code: 'BAD_JSON' } };
  }

  if (status >= 500) logger.error({ err, url: req.originalUrl }, 'Unhandled error');
  res.status(status).json(body);
};
