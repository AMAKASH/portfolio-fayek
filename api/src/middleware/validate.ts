import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces req.body / req.query / req.params with zod.
 * Parsed body replaces req.body; parsed query is stored on req.validQuery
 * (Express 5 makes req.query a read-only getter). ZodErrors go to errorHandler as 400s.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
    if (schemas.query) req.validQuery = schemas.query.parse(req.query);
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    next();
  };
}

export function q<S extends ZodTypeAny>(req: { validQuery?: unknown }, _schema: S): z.infer<S> {
  return req.validQuery as z.infer<S>;
}
