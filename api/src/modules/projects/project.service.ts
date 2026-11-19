import { Types } from 'mongoose';
import { cache, cached } from '../../lib/cache.js';
import { HttpError } from '../../lib/http-error.js';
import { slugify } from '../../lib/slugify.js';
import { ProjectModel, type ProjectDoc } from './project.model.js';
import type { BlockInput, ProjectInput, ProjectPatch, ProjectUpdate } from './project.schema.js';

const CACHE_PREFIX = 'projects:';
const PUBLISHED = { status: 'published' } as const;

export function invalidatePublic(): void {
  cache.invalidatePrefix(CACHE_PREFIX);
}

/* ------------------------------------------------------------------ */
/* Serialisation                                                       */
/* ------------------------------------------------------------------ */

type LeanProject = Record<string, any> & { _id: Types.ObjectId; __v?: number };

function serializeBlocks(blocks: any[] = []) {
  return blocks.map((b) => {
    const base = { id: String(b._id), type: b.type };
    if (b.type === 'text') return { ...base, heading: b.heading ?? '', body: b.body ?? '' };
    return { ...base, layout: b.layout, items: b.items ?? [], caption: b.caption ?? '' };
  });
}

/** Full admin representation (includes status, ordering and the concurrency `version`). */
export function toAdmin(p: LeanProject | ProjectDoc) {
  const o: LeanProject = 'toObject' in p ? (p as ProjectDoc).toObject() : (p as LeanProject);
  return {
    id: String(o._id),
    version: o.__v ?? 0,
    slug: o.slug,
    title: o.title,
    description: o.description ?? '',
    thumbnail: o.thumbnail ?? '',
    hero: { image: o.hero?.image ?? '', video: o.hero?.video ?? '', poster: o.hero?.poster ?? '' },
    mainTitle: o.mainTitle ?? '',
    subtitle: o.subtitle ?? '',
    client: o.client ?? '',
    involvement: o.involvement ?? [],
    result: o.result ?? '',
    blocks: serializeBlocks(o.blocks),
    status: o.status,
    listed: o.listed,
    order: o.order,
    featured: o.featured,
    featuredOrder: o.featuredOrder,
    featuredImage: o.featuredImage ?? '',
    featuredLabel: o.featuredLabel ?? '',
    seo: {
      metaTitle: o.seo?.metaTitle ?? '',
      metaDescription: o.seo?.metaDescription ?? '',
      ogImage: o.seo?.ogImage ?? '',
    },
    publishedAt: o.publishedAt ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function toPublic(o: LeanProject) {
  const a = toAdmin(o);
  return {
    slug: a.slug,
    title: a.title,
    description: a.description,
    thumbnail: a.thumbnail,
    hero: a.hero,
    mainTitle: a.mainTitle,
    subtitle: a.subtitle,
    client: a.client,
    involvement: a.involvement,
    result: a.result,
    blocks: a.blocks,
    seo: a.seo,
    publishedAt: a.publishedAt,
    updatedAt: a.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Public reads (cached)                                               */
/* ------------------------------------------------------------------ */

export function listPublic() {
  return cached(`${CACHE_PREFIX}list`, async () => {
    const rows = await ProjectModel.find({ ...PUBLISHED, listed: true })
      .sort({ order: 1, _id: 1 })
      .select('slug title description thumbnail')
      .lean();
    return rows.map((r) => ({ slug: r.slug, title: r.title, description: r.description, thumbnail: r.thumbnail }));
  });
}

export function listFeatured() {
  return cached(`${CACHE_PREFIX}featured`, async () => {
    const rows = await ProjectModel.aggregate<{
      slug: string;
      title: string;
      featuredLabel: string;
      featuredImage: string;
      thumbnail: string;
    }>([
      { $match: { ...PUBLISHED, featured: true } },
      { $sort: { featuredOrder: 1, _id: 1 } },
      {
        $project: {
          _id: 0,
          slug: 1,
          title: 1,
          featuredLabel: 1,
          featuredImage: 1,
          thumbnail: 1,
        },
      },
    ]);
    return rows.map((r) => ({
      slug: r.slug,
      title: r.featuredLabel || r.title,
      image: r.featuredImage || r.thumbnail || '',
    }));
  });
}

type Neighbour = { slug: string; title: string; heroImage: string; thumbnail: string };

async function neighbours(order: number, selfId: Types.ObjectId): Promise<{ prev: Neighbour | null; next: Neighbour | null }> {
  const base = { ...PUBLISHED, listed: true, _id: { $ne: selfId } };
  const fields = 'slug title hero.image thumbnail';
  const [prev, next] = await Promise.all([
    ProjectModel.findOne({ ...base, order: { $lt: order } }).sort({ order: -1 }).select(fields).lean()
      .then((r) => r ?? ProjectModel.findOne(base).sort({ order: -1 }).select(fields).lean()),
    ProjectModel.findOne({ ...base, order: { $gt: order } }).sort({ order: 1 }).select(fields).lean()
      .then((r) => r ?? ProjectModel.findOne(base).sort({ order: 1 }).select(fields).lean()),
  ]);
  const map = (r: any): Neighbour | null =>
    r ? { slug: r.slug, title: r.title, heroImage: r.hero?.image || r.thumbnail || '', thumbnail: r.thumbnail ?? '' } : null;
  return { prev: map(prev), next: map(next) };
}

export function getPublicBySlug(slug: string) {
  return cached(`${CACHE_PREFIX}slug:${slug}`, async () => {
    const p = await ProjectModel.findOne({ ...PUBLISHED, slug }).lean();
    if (!p) return null;
    return { ...toPublic(p as LeanProject), ...(await neighbours(p.order, p._id)) };
  }).then((r) => {
    if (!r) throw HttpError.notFound('Project not found');
    return r;
  });
}

/** Legacy /works/:idx support: the Nth listed project (0-based, in display order). */
export async function getPublicSlugByIndex(index: number): Promise<{ slug: string }> {
  const list = await listPublic();
  const item = list[index];
  if (!item) throw HttpError.notFound('Project not found');
  return { slug: item.slug };
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function adminList(opts: { search?: string; status?: 'draft' | 'published'; page: number; limit: number }) {
  const filter: Record<string, unknown> = {};
  if (opts.status) filter['status'] = opts.status;
  if (opts.search) {
    const rx = new RegExp(escapeRegex(opts.search), 'i');
    filter['$or'] = [{ title: rx }, { client: rx }, { slug: rx }, { description: rx }];
  }
  const [rows, total] = await Promise.all([
    ProjectModel.aggregate([
      { $match: filter },
      { $sort: { order: 1, _id: 1 } },
      { $skip: (opts.page - 1) * opts.limit },
      { $limit: opts.limit },
      {
        $project: {
          slug: 1, title: 1, description: 1, thumbnail: 1, status: 1, listed: 1, order: 1,
          featured: 1, featuredOrder: 1, featuredImage: 1, featuredLabel: 1, updatedAt: 1, publishedAt: 1,
          'hero.image': 1,
          blockCount: { $size: { $ifNull: ['$blocks', []] } },
        },
      },
    ]),
    ProjectModel.countDocuments(filter),
  ]);
  return {
    items: rows.map((r: any) => ({
      id: String(r._id),
      slug: r.slug,
      title: r.title,
      description: r.description ?? '',
      thumbnail: r.thumbnail || r.hero?.image || '',
      status: r.status,
      listed: r.listed,
      order: r.order,
      featured: r.featured,
      featuredOrder: r.featuredOrder,
      featuredImage: r.featuredImage || r.thumbnail || '',
      featuredLabel: r.featuredLabel ?? '',
      blockCount: r.blockCount,
      updatedAt: r.updatedAt,
      publishedAt: r.publishedAt ?? null,
    })),
    total,
    page: opts.page,
    limit: opts.limit,
  };
}

export async function adminGet(id: string) {
  const p = await ProjectModel.findById(id).lean();
  if (!p) throw HttpError.notFound('Project not found');
  return toAdmin(p as LeanProject);
}

export async function isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  const filter: Record<string, unknown> = { slug };
  if (excludeId) filter['_id'] = { $ne: excludeId };
  return !(await ProjectModel.exists(filter));
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'project';
  let candidate = root;
  for (let i = 2; !(await isSlugAvailable(candidate, excludeId)); i++) candidate = `${root}-${i}`;
  return candidate;
}

async function nextValue(field: 'order' | 'featuredOrder'): Promise<number> {
  const last = await ProjectModel.findOne().sort({ [field]: -1 }).select(field).lean();
  return ((last as any)?.[field] ?? -1) + 1;
}

function toBlockDocs(blocks: BlockInput[]) {
  return blocks.map(({ id, ...b }) => ({
    ...(id && Types.ObjectId.isValid(id) ? { _id: new Types.ObjectId(id) } : {}),
    ...b,
  }));
}

function toDocFields(input: ProjectInput) {
  const { slug: _slug, blocks, ...rest } = input;
  return { ...rest, blocks: toBlockDocs(blocks) };
}

export async function create(input: ProjectInput) {
  let slug: string;
  if (input.slug) {
    if (!(await isSlugAvailable(input.slug))) throw HttpError.conflict('Slug already in use', 'SLUG_TAKEN');
    slug = input.slug;
  } else {
    slug = await uniqueSlug(input.title);
  }
  const doc = await ProjectModel.create({
    ...toDocFields(input),
    slug,
    order: await nextValue('order'),
    featuredOrder: input.featured ? await nextValue('featuredOrder') : 0,
    publishedAt: input.status === 'published' ? new Date() : undefined,
  });
  invalidatePublic();
  return toAdmin(doc);
}

export async function update(id: string, input: ProjectUpdate) {
  const doc = await ProjectModel.findById(id);
  if (!doc) throw HttpError.notFound('Project not found');
  if (doc.__v !== input.version) {
    throw HttpError.conflict('This project was changed elsewhere. Reload to get the latest version.', 'VERSION_CONFLICT', {
      currentVersion: doc.__v,
    });
  }
  const { version: _v, ...data } = input;
  const slug = data.slug ?? doc.slug;
  if (slug !== doc.slug && !(await isSlugAvailable(slug, id))) {
    throw HttpError.conflict('Slug already in use', 'SLUG_TAKEN');
  }
  const wasFeatured = doc.featured;
  const wasPublished = doc.status === 'published';
  doc.set({ ...toDocFields(data), slug });
  if (data.featured && !wasFeatured) doc.featuredOrder = await nextValue('featuredOrder');
  if (data.status === 'published' && !wasPublished && !doc.publishedAt) doc.publishedAt = new Date();
  // Always bump the version so every successful save invalidates other open editors.
  doc.increment();
  await doc.save();
  invalidatePublic();
  return toAdmin(doc);
}

export async function patch(id: string, input: ProjectPatch) {
  const doc = await ProjectModel.findById(id);
  if (!doc) throw HttpError.notFound('Project not found');
  if (input.featured === true && !doc.featured) doc.featuredOrder = await nextValue('featuredOrder');
  if (input.status === 'published' && !doc.publishedAt) doc.publishedAt = new Date();
  doc.set(input);
  doc.increment();
  await doc.save();
  invalidatePublic();
  return toAdmin(doc);
}

export async function remove(id: string): Promise<void> {
  const res = await ProjectModel.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw HttpError.notFound('Project not found');
  invalidatePublic();
}

export async function duplicate(id: string) {
  const src = await ProjectModel.findById(id).lean();
  if (!src) throw HttpError.notFound('Project not found');
  const { _id, __v, createdAt: _c, updatedAt: _u, publishedAt: _p, ...rest } = src as LeanProject;
  const doc = await ProjectModel.create({
    ...rest,
    title: `${src.title} (copy)`,
    slug: await uniqueSlug(`${src.slug}-copy`),
    status: 'draft',
    featured: false,
    featuredOrder: 0,
    order: await nextValue('order'),
    blocks: (src.blocks ?? []).map(({ _id: _b, ...b }: any) => b),
  });
  invalidatePublic();
  return toAdmin(doc);
}

async function applyOrder(ids: string[], field: 'order' | 'featuredOrder') {
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw HttpError.badRequest('Duplicate ids in order list');
  const found = await ProjectModel.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw HttpError.badRequest('Order list contains unknown project ids');
  await ProjectModel.bulkWrite(
    ids.map((id, i) => ({
      // No version bump: order isn't part of the editor form, so reordering must not
      // invalidate an editor that's open in another tab.
      updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $set: { [field]: i } } },
    })),
    { ordered: false },
  );
  invalidatePublic();
}

export const reorder = (ids: string[]) => applyOrder(ids, 'order');
export const reorderFeatured = (ids: string[]) => applyOrder(ids, 'featuredOrder');

/** Every project field that can hold a media URL — used to block deleting in-use media. */
export async function countUrlReferences(url: string): Promise<number> {
  return ProjectModel.countDocuments({
    $or: [
      { thumbnail: url },
      { 'hero.image': url },
      { 'hero.video': url },
      { 'hero.poster': url },
      { featuredImage: url },
      { 'seo.ogImage': url },
      { 'blocks.items.url': url },
      { 'blocks.items.poster': url },
    ],
  });
}
