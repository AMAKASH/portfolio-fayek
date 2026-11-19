import type { Request, Response } from 'express';
import { q } from '../../middleware/validate.js';
import { adminListQuery, slugAvailableQuery } from './project.schema.js';
import * as svc from './project.service.js';

/* Public */
export async function list(_req: Request, res: Response) {
  res.json({ items: await svc.listPublic() });
}

export async function featured(_req: Request, res: Response) {
  res.json({ items: await svc.listFeatured() });
}

export async function bySlug(req: Request, res: Response) {
  const slug = req.params['slug'] as string;
  // Legacy numeric URLs (/works/3) resolve to the slug of the Nth listed project.
  if (/^\d+$/.test(slug)) {
    res.json({ redirect: await svc.getPublicSlugByIndex(Number(slug)) });
    return;
  }
  res.json(await svc.getPublicBySlug(slug));
}

/* Admin */
export async function adminList(req: Request, res: Response) {
  res.json(await svc.adminList(q(req, adminListQuery)));
}

export async function adminGet(req: Request, res: Response) {
  res.json(await svc.adminGet(req.params['id'] as string));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await svc.create(req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await svc.update(req.params['id'] as string, req.body));
}

export async function patch(req: Request, res: Response) {
  res.json(await svc.patch(req.params['id'] as string, req.body));
}

export async function remove(req: Request, res: Response) {
  await svc.remove(req.params['id'] as string);
  res.status(204).end();
}

export async function duplicate(req: Request, res: Response) {
  res.status(201).json(await svc.duplicate(req.params['id'] as string));
}

export async function reorder(req: Request, res: Response) {
  await svc.reorder(req.body.ids);
  res.status(204).end();
}

export async function reorderFeatured(req: Request, res: Response) {
  await svc.reorderFeatured(req.body.ids);
  res.status(204).end();
}

export async function slugAvailable(req: Request, res: Response) {
  const { slug, excludeId } = q(req, slugAvailableQuery);
  res.json({ slug, available: await svc.isSlugAvailable(slug, excludeId) });
}
