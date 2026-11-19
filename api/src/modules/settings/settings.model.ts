import { Schema, model, type InferSchemaType } from 'mongoose';

/** Default home hero (the image that was hard-coded in the landing page). */
export const DEFAULT_HOME_HERO = {
  image:
    'https://ik.imagekit.io/uhvinpqxo/New%20Warc%20Website/assets/images/LandingPage/heroImage.png?updatedAt=1725444739430',
  mobileImage: '',
  video: '',
  poster: '',
  alt: '',
  /** "All Projects" button vertical position, % from the top of the hero */
  buttonTopDesktop: 72,
  buttonTopMobile: 67,
};

/**
 * Site-wide editable content. A single document (key: 'site'); add new fields here
 * (and to settings.schema.ts) for other dynamic sections.
 */
const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'site' },
    homeHero: {
      image: { type: String, default: DEFAULT_HOME_HERO.image },
      /** Optional portrait crop for phones (the hero is 1:1.8 on mobile, ~2:1 on desktop). */
      mobileImage: { type: String, default: '' },
      /** Optional: if set, a muted looping video plays instead of the image. */
      video: { type: String, default: '' },
      poster: { type: String, default: '' },
      alt: { type: String, default: '' },
      /** "All Projects" button position (% from the top of the hero) */
      buttonTopDesktop: { type: Number, default: DEFAULT_HOME_HERO.buttonTopDesktop },
      buttonTopMobile: { type: Number, default: DEFAULT_HOME_HERO.buttonTopMobile },
    },
  },
  { timestamps: true },
);

export type Settings = InferSchemaType<typeof settingsSchema>;
export const SettingsModel = model('Settings', settingsSchema);
