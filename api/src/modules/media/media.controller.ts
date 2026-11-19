import type { Request, Response } from 'express';
import { ALLOWED_MIME, mediaListQuery } from './media.schema.js';
import { q } from '../../middleware/validate.js';
import { s3Configured } from '../../lib/s3.js';
import * as svc from './media.service.js';

export async function config(_req: Request, res: Response) {
  res.json({ enabled: s3Configured(), allowedTypes: ALLOWED_MIME, ...svc.limits() });
}

export async function presign(req: Request, res: Response) {
  res.json(await svc.presign(req.body));
}

export async function confirm(req: Request, res: Response) {
  res.status(201).json(await svc.confirm(req.body));
}

export async function list(req: Request, res: Response) {
  res.json(await svc.list(q(req, mediaListQuery)));
}

export async function patch(req: Request, res: Response) {
  res.json(await svc.updateAlt(req.params['id'] as string, req.body.alt));
}

export async function remove(req: Request, res: Response) {
  await svc.remove(req.params['id'] as string);
  res.status(204).end();
}
