import { z } from 'zod';

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml'] as const;
export const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const ALLOWED_MIME = [...IMAGE_MIME, ...VIDEO_MIME] as const;

export function kindOf(mime: string): 'image' | 'video' | null {
  if ((IMAGE_MIME as readonly string[]).includes(mime)) return 'image';
  if ((VIDEO_MIME as readonly string[]).includes(mime)) return 'video';
  return null;
}

export const presignSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(ALLOWED_MIME, { errorMap: () => ({ message: `Allowed types: ${ALLOWED_MIME.join(', ')}` }) }),
  size: z.number().int().positive(),
});

export const confirmSchema = z.object({
  key: z.string().trim().min(1).max(1024),
  originalName: z.string().trim().max(255).optional().default(''),
  alt: z.string().trim().max(300).optional().default(''),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  duration: z.number().positive().max(36000).optional(),
});

export const mediaListQuery = z.object({
  kind: z.enum(['image', 'video']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

export const mediaPatchSchema = z.object({ alt: z.string().trim().max(300) });
export const mediaIdParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });
