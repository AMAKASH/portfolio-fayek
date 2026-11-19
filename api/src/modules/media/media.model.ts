import { Schema, model, type InferSchemaType } from 'mongoose';

const mediaSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    kind: { type: String, enum: ['image', 'video'], required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    width: Number,
    height: Number,
    duration: Number,
    alt: { type: String, default: '' },
    originalName: { type: String, default: '' },
  },
  { timestamps: true },
);

mediaSchema.index({ createdAt: -1 });
mediaSchema.index({ kind: 1, createdAt: -1 });

export type Media = InferSchemaType<typeof mediaSchema>;
export const MediaModel = model('Media', mediaSchema);
