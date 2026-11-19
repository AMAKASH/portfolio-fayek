import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';
import { bucket, getS3, publicUrlForKey } from '../../lib/s3.js';
import { slugify } from '../../lib/slugify.js';
import { countUrlReferences } from '../projects/project.service.js';
import { countUrlReferences as countSettingsReferences } from '../settings/settings.service.js';
import { MediaModel } from './media.model.js';
import { kindOf } from './media.schema.js';

const MB = 1024 * 1024;
/** Keys are content-unique (uuid), so objects can be cached forever at the edge. */
export const UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const PRESIGN_TTL_SECONDS = 15 * 60;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export function maxBytesFor(kind: 'image' | 'video'): number {
  return Math.floor((kind === 'image' ? env.MAX_IMAGE_MB : env.MAX_VIDEO_MB) * MB);
}

function buildKey(filename: string, mime: string): string {
  const now = new Date();
  const base = slugify(filename.replace(/\.[^.]+$/, '')).slice(0, 60) || 'file';
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${env.S3_PREFIX}/${yyyy}/${mm}/${randomUUID()}-${base}.${EXT_BY_MIME[mime] ?? 'bin'}`;
}

function serialize(m: any) {
  return {
    id: String(m._id),
    key: m.key,
    url: m.url,
    kind: m.kind,
    mime: m.mime,
    size: m.size,
    width: m.width ?? null,
    height: m.height ?? null,
    duration: m.duration ?? null,
    alt: m.alt ?? '',
    originalName: m.originalName ?? '',
    createdAt: m.createdAt,
  };
}

/**
 * Issues a presigned POST so the browser uploads directly to S3.
 * The policy pins size range, Content-Type and Cache-Control, so the client
 * cannot upload something different from what was approved here.
 */
export async function presign(input: { filename: string; contentType: string; size: number }) {
  const kind = kindOf(input.contentType);
  if (!kind) throw HttpError.badRequest('Unsupported file type');
  const maxBytes = maxBytesFor(kind);
  if (input.size > maxBytes) {
    throw HttpError.badRequest(`File too large. Max ${kind} size is ${Math.round(maxBytes / MB)} MB`);
  }
  const key = buildKey(input.filename, input.contentType);
  const { url, fields } = await createPresignedPost(getS3(), {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ['content-length-range', 1, maxBytes],
      ['eq', '$Content-Type', input.contentType],
      ['eq', '$Cache-Control', UPLOAD_CACHE_CONTROL],
    ],
    Fields: { 'Content-Type': input.contentType, 'Cache-Control': UPLOAD_CACHE_CONTROL },
    Expires: PRESIGN_TTL_SECONDS,
  });
  return { upload: { url, fields }, key, publicUrl: publicUrlForKey(key), kind, maxBytes, expiresIn: PRESIGN_TTL_SECONDS };
}

/** Called after the browser finished uploading: verifies the object and records it in the library. */
export async function confirm(input: {
  key: string;
  originalName: string;
  alt: string;
  width?: number;
  height?: number;
  duration?: number;
}) {
  if (!input.key.startsWith(`${env.S3_PREFIX}/`) || input.key.includes('..')) {
    throw HttpError.badRequest('Invalid key');
  }
  let head;
  try {
    head = await getS3().send(new HeadObjectCommand({ Bucket: bucket(), Key: input.key }));
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') {
      throw HttpError.badRequest('Upload not found in storage. Did the upload finish?');
    }
    throw e;
  }
  const mime = head.ContentType ?? '';
  const kind = kindOf(mime);
  if (!kind) throw HttpError.badRequest('Stored object has an unsupported type');

  const doc = await MediaModel.findOneAndUpdate(
    { key: input.key },
    {
      $set: {
        url: publicUrlForKey(input.key),
        kind,
        mime,
        size: head.ContentLength ?? 0,
        width: input.width,
        height: input.height,
        duration: input.duration,
        alt: input.alt,
        originalName: input.originalName,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return serialize(doc);
}

export async function list(opts: { kind?: 'image' | 'video'; search?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = {};
  if (opts.kind) filter['kind'] = opts.kind;
  if (opts.search) {
    const rx = new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter['$or'] = [{ originalName: rx }, { alt: rx }];
  }
  const [rows, total] = await Promise.all([
    MediaModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .lean(),
    MediaModel.countDocuments(filter),
  ]);
  return { items: rows.map(serialize), total, page: opts.page, limit: opts.limit };
}

export async function updateAlt(id: string, alt: string) {
  const doc = await MediaModel.findByIdAndUpdate(id, { $set: { alt } }, { new: true }).lean();
  if (!doc) throw HttpError.notFound('Media not found');
  return serialize(doc);
}

export async function remove(id: string): Promise<void> {
  const doc = await MediaModel.findById(id).lean();
  if (!doc) throw HttpError.notFound('Media not found');
  const [refs, settingsRefs] = await Promise.all([countUrlReferences(doc.url), countSettingsReferences(doc.url)]);
  if (refs > 0 || settingsRefs > 0) {
    const where = [refs ? `${refs} project(s)` : '', settingsRefs ? 'site settings (hero, branding or contact icons)' : ''].filter(Boolean).join(' and ');
    throw HttpError.conflict(`In use by ${where}. Remove it there first.`, 'MEDIA_IN_USE', {
      projects: refs,
      settings: settingsRefs,
    });
  }
  await getS3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: doc.key }));
  await MediaModel.deleteOne({ _id: id });
}

export function limits() {
  return { maxImageBytes: maxBytesFor('image'), maxVideoBytes: maxBytesFor('video') };
}
