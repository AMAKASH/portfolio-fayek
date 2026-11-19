import { z } from 'zod';

const url = z.string().trim().max(2048).optional().default('');

export const homeHeroSchema = z.object({
  image: z.string().trim().min(1, 'A hero image is required').max(2048),
  mobileImage: url,
  video: url,
  poster: url,
  alt: z.string().trim().max(300).optional().default(''),
});

export const settingsUpdateSchema = z.object({
  homeHero: homeHeroSchema,
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
