import { z } from 'zod';
import { DEFAULT_HOME_HERO } from './settings.model.js';

const url = z.string().trim().max(2048).optional().default('');

export const homeHeroSchema = z.object({
  image: z.string().trim().min(1, 'A hero image is required').max(2048),
  mobileImage: url,
  video: url,
  poster: url,
  alt: z.string().trim().max(300).optional().default(''),
  /** "All Projects" button position, % from the top of the hero (0 = top, 100 = bottom) */
  buttonTopDesktop: z.number().min(0).max(100).optional().default(DEFAULT_HOME_HERO.buttonTopDesktop),
  buttonTopMobile: z.number().min(0).max(100).optional().default(DEFAULT_HOME_HERO.buttonTopMobile),
});

export const settingsUpdateSchema = z.object({
  homeHero: homeHeroSchema,
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
