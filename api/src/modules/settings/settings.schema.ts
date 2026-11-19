import { z } from 'zod';
import { CONTACT_LINK_TYPES, DEFAULT_HOME_HERO } from './settings.model.js';

const url = z.string().trim().max(2048).optional().default('');

export const homeHeroSchema = z.object({
  image: z.string().trim().min(1, 'A hero image is required').max(2048),
  mobileImage: url,
  video: url,
  poster: url,
  alt: z.string().trim().max(300).optional().default(''),
  /** "Works" button position, % from the top of the hero (0 = top, 100 = bottom) */
  buttonTopDesktop: z.number().min(0).max(100).optional().default(DEFAULT_HOME_HERO.buttonTopDesktop),
  buttonTopMobile: z.number().min(0).max(100).optional().default(DEFAULT_HOME_HERO.buttonTopMobile),
});

export const contactLinkSchema = z
  .object({
    type: z.enum(CONTACT_LINK_TYPES),
    /** Full URL; for `email` a bare address is fine (mailto: is added), for `whatsapp` a phone number works too. */
    url: z.string().trim().min(1, 'Link is required').max(2048),
    label: z.string().trim().max(60).optional().default(''),
    icon: url,
  })
  .superRefine((l, ctx) => {
    if (l.type === 'custom' && !l.icon) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['icon'], message: 'Custom links need an icon image' });
    }
  });

export const contactSchema = z.object({
  heading: z.string().trim().max(120),
  text: z.string().trim().max(600),
  links: z.array(contactLinkSchema).max(12),
});

export const projectCtaSchema = z.object({
  heading: z.string().trim().max(160),
  lines: z.array(z.string().trim().min(1).max(160)).max(6),
  buttonLabel: z.string().trim().max(40),
  /** Empty hides the button */
  buttonUrl: z.string().trim().max(2048),
});

export const brandingSchema = z.object({
  logo: z.string().trim().min(1, 'A header logo is required').max(2048),
  /** Empty = bundled favicon */
  favicon: url,
});

export const tickerSchema = z.object({
  /** Empty list hides the ticker */
  items: z.array(z.string().trim().min(1).max(60)).max(20),
});

/** Partial update: only the sections sent are replaced. */
export const settingsUpdateSchema = z
  .object({
    homeHero: homeHeroSchema.optional(),
    branding: brandingSchema.optional(),
    ticker: tickerSchema.optional(),
    contact: contactSchema.optional(),
    projectCta: projectCtaSchema.optional(),
  })
  .refine((v) => v.homeHero || v.branding || v.ticker || v.contact || v.projectCta, 'Nothing to update');

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
