import { Schema, model, type InferSchemaType } from 'mongoose';

/** Default home hero (the image that was hard-coded in the landing page). */
export const DEFAULT_HOME_HERO = {
  image:
    'https://ik.imagekit.io/uhvinpqxo/New%20Warc%20Website/assets/images/LandingPage/heroImage.png?updatedAt=1725444739430',
  mobileImage: '',
  video: '',
  poster: '',
  alt: '',
  /** "Works" button vertical position, % from the top of the hero */
  buttonTopDesktop: 72,
  buttonTopMobile: 67,
};

/** Platforms with built-in icons. `custom` uses an uploaded icon image. */
export const CONTACT_LINK_TYPES = ['email', 'whatsapp', 'instagram', 'linkedin', 'facebook', 'location', 'custom'] as const;
export type ContactLinkType = (typeof CONTACT_LINK_TYPES)[number];

/** Default header contact panel (what was hard-coded before). */
export const DEFAULT_CONTACT = {
  heading: "Interested? Let's Warc",
  text: "If you appreciate our work, then let's schedule a meeting and start working. We thrive on new challenges.",
  links: [
    { type: 'email' as ContactLinkType, url: 'fayek.warc.digital@gmail.com', label: '', icon: '' },
    { type: 'whatsapp' as ContactLinkType, url: 'https://wa.me/message/2N34R772T4SMJ1', label: '', icon: '' },
    { type: 'instagram' as ContactLinkType, url: 'https://www.instagram.com/f5yek/', label: '', icon: '' },
    { type: 'linkedin' as ContactLinkType, url: 'https://www.linkedin.com/in/fayekrafi/', label: '', icon: '' },
  ],
};

/** Default call-to-action at the bottom of project pages. */
export const DEFAULT_PROJECT_CTA = {
  heading: 'Make Contact, Make Impact.',
  lines: ['WITH US IT HAPPENS.', 'WE WOULD LOVE TO HEAR FROM YOU.'],
  buttonLabel: "Let's Talk",
  buttonUrl: 'https://wa.me/message/2N34R772T4SMJ1',
};

/** Default header ticker (the scrolling service list beside the logo), exactly as it was hard-coded. */
export const DEFAULT_TICKER = {
  items: ['Web Devolopment', 'UI/UX', 'SaaS', 'ERP', 'AR/VR', 'App Devolopment', 'Robotics & Hardware'],
};

/** Default branding: the header wordmark on the CDN; empty favicon = the bundled "FR" icons. */
export const DEFAULT_BRANDING = {
  logo: 'https://dkr8ufw2tu8er.cloudfront.net/fayek%20al%20rafi_logo.png',
  favicon: '',
};

const contactLinkSchema = new Schema(
  {
    type: { type: String, enum: CONTACT_LINK_TYPES, required: true },
    url: { type: String, required: true },
    /** Accessible name (and tooltip). Defaults to the platform name. */
    label: { type: String, default: '' },
    /** Icon image URL, used only for `custom` links. */
    icon: { type: String, default: '' },
  },
  { _id: false },
);

/**
 * Site-wide editable content. A single document (key: 'site').
 * Sections without a stored value fall back to the DEFAULT_* constants (see settings.service),
 * so fields here deliberately have no defaults — an absent section means "not customised yet".
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
      /** "Works" button position (% from the top of the hero) */
      buttonTopDesktop: { type: Number, default: DEFAULT_HOME_HERO.buttonTopDesktop },
      buttonTopMobile: { type: Number, default: DEFAULT_HOME_HERO.buttonTopMobile },
    },
    branding: {
      /** Header logo (white wordmark on the dark header bar) */
      logo: String,
      /** Square PNG/SVG; empty = bundled favicon.ico + icons */
      favicon: String,
    },
    /** Header ticker: texts scrolling beside the logo */
    ticker: {
      items: { type: [String], default: undefined },
    },
    contact: {
      heading: String,
      text: String,
      links: { type: [contactLinkSchema], default: undefined },
    },
    projectCta: {
      heading: String,
      lines: { type: [String], default: undefined },
      buttonLabel: String,
      buttonUrl: String,
    },
  },
  { timestamps: true },
);

export type Settings = InferSchemaType<typeof settingsSchema>;
export const SettingsModel = model('Settings', settingsSchema);
