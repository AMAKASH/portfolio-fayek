import { z } from 'zod';

const url = z.string().trim().min(1).max(2048);
const optUrl = z.string().trim().max(2048).optional().default('');
const text = (max: number) => z.string().trim().max(max).optional().default('');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const mediaItemSchema = z.object({
  kind: z.enum(['image', 'video']),
  url,
  alt: text(300),
  poster: optUrl,
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  mediaId: objectId.optional(),
});

const mediaBlock = z
  .object({
    id: z.string().optional(),
    type: z.literal('media'),
    /** full = one item spanning the width, split = two items side-by-side */
    layout: z.enum(['full', 'split']),
    items: z.array(mediaItemSchema).min(1).max(2),
    caption: text(500),
  })
  .superRefine((b, ctx) => {
    const expected = b.layout === 'full' ? 1 : 2;
    if (b.items.length !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: `layout "${b.layout}" needs exactly ${expected} item(s)`,
      });
    }
  });

const textBlock = z.object({
  id: z.string().optional(),
  type: z.literal('text'),
  heading: text(300),
  body: z.string().trim().min(1).max(20000),
});

export const blockSchema = z.union([mediaBlock, textBlock]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes');

export const projectInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: slugSchema.optional().or(z.literal('').transform(() => undefined)),
  description: text(300),
  thumbnail: optUrl,
  hero: z
    .object({ image: optUrl, video: optUrl, poster: optUrl })
    .optional()
    .default({ image: '', video: '', poster: '' }),
  mainTitle: text(300),
  subtitle: text(500),
  client: text(200),
  involvement: z.array(z.string().trim().min(1).max(100)).max(30).optional().default([]),
  result: text(5000),
  blocks: z.array(blockSchema).max(200).optional().default([]),
  status: z.enum(['draft', 'published']).optional().default('draft'),
  listed: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  featuredImage: optUrl,
  featuredLabel: text(200),
  seo: z
    .object({ metaTitle: text(200), metaDescription: text(500), ogImage: optUrl })
    .optional()
    .default({ metaTitle: '', metaDescription: '', ogImage: '' }),
});

export const projectUpdateSchema = projectInputSchema.extend({
  /** Optimistic concurrency token returned as `version` by every admin read. */
  version: z.number().int().min(0),
});

export const projectPatchSchema = z
  .object({
    status: z.enum(['draft', 'published']),
    listed: z.boolean(),
    featured: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const reorderSchema = z.object({ ids: z.array(objectId).min(1).max(1000) });

export const idParams = z.object({ id: objectId });
export const slugParams = z.object({ slug: z.string().trim().toLowerCase().min(1).max(80) });

export const adminListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'published']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const slugAvailableQuery = z.object({
  slug: slugSchema,
  excludeId: objectId.optional(),
});

export type MediaItemInput = z.infer<typeof mediaItemSchema>;
export type BlockInput = z.infer<typeof blockSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type ProjectPatch = z.infer<typeof projectPatchSchema>;
