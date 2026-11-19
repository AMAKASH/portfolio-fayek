import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const mediaItemSchema = new Schema(
  {
    kind: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    poster: { type: String, default: '' },
    width: Number,
    height: Number,
    mediaId: { type: Schema.Types.ObjectId, ref: 'Media' },
  },
  { _id: false },
);

/**
 * One schema for every block type (zod enforces the per-type shape on input).
 * Blocks keep an _id so the admin can track them across drag-and-drop reorders.
 */
const blockSchema = new Schema({
  type: { type: String, enum: ['media', 'text'], required: true },
  layout: { type: String, enum: ['full', 'split'] },
  items: { type: [mediaItemSchema], default: undefined },
  caption: String,
  heading: String,
  body: String,
});

const projectSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    hero: {
      image: { type: String, default: '' },
      video: { type: String, default: '' },
      poster: { type: String, default: '' },
    },
    mainTitle: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    client: { type: String, default: '' },
    involvement: { type: [String], default: [] },
    result: { type: String, default: '' },
    blocks: { type: [blockSchema], default: [] },

    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    /** Shown in the works grid (/works). Unlisted published projects are reachable by slug / landing tile. */
    listed: { type: Boolean, default: true },
    /** Works-grid and prev/next order (ascending). */
    order: { type: Number, default: 0 },

    featured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0 },
    featuredImage: { type: String, default: '' },
    featuredLabel: { type: String, default: '' },

    seo: {
      metaTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      ogImage: { type: String, default: '' },
    },
    publishedAt: { type: Date },
  },
  { timestamps: true, optimisticConcurrency: true },
);

projectSchema.index({ status: 1, listed: 1, order: 1 });
projectSchema.index({ status: 1, featured: 1, featuredOrder: 1 });
projectSchema.index({ order: 1 });

export type Project = InferSchemaType<typeof projectSchema>;
export type ProjectDoc = HydratedDocument<Project>;
export const ProjectModel = model('Project', projectSchema);
