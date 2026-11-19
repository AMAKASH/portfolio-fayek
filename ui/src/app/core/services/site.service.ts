import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { API_BASE } from '../api/api.config';
import {
  Ticker,
  Branding,
  ContactLink,
  ContactLinkType,
  ContactSettings,
  HomeHero,
  ProjectCta,
  SiteSettings,
} from '../models/project';

/* ------------------------------------------------------------------ */
/* Defaults — mirror api/src/modules/settings/settings.model.ts.       */
/* Used when the API is unreachable, so pages never render empty.      */
/* ------------------------------------------------------------------ */

export const FALLBACK_HOME_HERO: HomeHero = {
  image:
    'https://ik.imagekit.io/uhvinpqxo/New%20Warc%20Website/assets/images/LandingPage/heroImage.png?updatedAt=1725444739430',
  mobileImage: '',
  video: '',
  poster: '',
  alt: '',
  buttonTopDesktop: 72,
  buttonTopMobile: 67,
};

export const FALLBACK_BRANDING: Branding = {
  logo: 'https://dkr8ufw2tu8er.cloudfront.net/fayek%20al%20rafi_logo.png',
  favicon: '',
};

export const FALLBACK_TICKER: Ticker = {
  items: ['Web Devolopment', 'UI/UX', 'SaaS', 'ERP', 'AR/VR', 'App Devolopment', 'Robotics & Hardware'],
};

export const FALLBACK_CONTACT: ContactSettings = {
  heading: "Interested? Let's Warc",
  text: "If you appreciate our work, then let's schedule a meeting and start working. We thrive on new challenges.",
  links: [
    { type: 'email', url: 'fayek.warc.digital@gmail.com', label: '', icon: '' },
    { type: 'whatsapp', url: 'https://wa.me/message/2N34R772T4SMJ1', label: '', icon: '' },
    { type: 'instagram', url: 'https://www.instagram.com/f5yek/', label: '', icon: '' },
    { type: 'linkedin', url: 'https://www.linkedin.com/in/fayekrafi/', label: '', icon: '' },
  ],
};

export const FALLBACK_PROJECT_CTA: ProjectCta = {
  heading: 'Make Contact, Make Impact.',
  lines: ['WITH US IT HAPPENS.', 'WE WOULD LOVE TO HEAR FROM YOU.'],
  buttonLabel: "Let's Talk",
  buttonUrl: 'https://wa.me/message/2N34R772T4SMJ1',
};

export const FALLBACK_SETTINGS: SiteSettings = {
  homeHero: FALLBACK_HOME_HERO,
  branding: FALLBACK_BRANDING,
  ticker: FALLBACK_TICKER,
  contact: FALLBACK_CONTACT,
  projectCta: FALLBACK_PROJECT_CTA,
  updatedAt: null,
};

/* ------------------------------------------------------------------ */
/* Contact link helpers (shared by the header and the admin preview)   */
/* ------------------------------------------------------------------ */

const IK = 'https://ik.imagekit.io/uhvinpqxo/New%20Warc%20Website/assets/header/socials/';

/** Platforms: display name, URL placeholder, and the PNG icon pair (normal / hover). LinkedIn is an inline SVG. */
export const CONTACT_PLATFORMS: Record<
  ContactLinkType,
  { name: string; placeholder: string; icon?: string; hover?: string }
> = {
  email: { name: 'Email', placeholder: 'you@example.com', icon: `${IK}Email.png?updatedAt=1725351159609`, hover: `${IK}hoveredemail.png?updatedAt=1725352918048` },
  whatsapp: { name: 'WhatsApp', placeholder: 'https://wa.me/… or +8801XXXXXXXXX', icon: `${IK}Whatsapp.png?updatedAt=1725351159598`, hover: `${IK}hoveredwhatsapp.png?updatedAt=1725352917882` },
  instagram: { name: 'Instagram', placeholder: 'https://www.instagram.com/…', icon: `${IK}Instagram.png?updatedAt=1725351159355`, hover: `${IK}hoveredInsta.png?updatedAt=1725352920655` },
  linkedin: { name: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/…' },
  facebook: { name: 'Facebook', placeholder: 'https://www.facebook.com/…', icon: `${IK}Facebook.png?updatedAt=1725351159518`, hover: `${IK}hoveredFacebook.png?updatedAt=1725352920595` },
  location: { name: 'Location', placeholder: 'https://maps.google.com/…', icon: `${IK}location.png?updatedAt=1725351159574`, hover: `${IK}hoveredLocation.png?updatedAt=1725352918117` },
  custom: { name: 'Custom', placeholder: 'https://…' },
};

/**
 * Normalises a stored link to an href:
 * - email: bare address → mailto:
 * - whatsapp: bare phone number → https://wa.me/<digits>
 * - anything else without a scheme → https://
 */
export function linkHref(type: ContactLinkType | 'auto', raw: string): string {
  const url = (raw ?? '').trim();
  if (!url) return '';
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  if ((type === 'email' || type === 'auto') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  if ((type === 'whatsapp' || type === 'auto') && /^\+?[\d\s()-]{6,}$/.test(url)) return `https://wa.me/${url.replace(/\D/g, '')}`;
  return `https://${url}`;
}

/** Links that open in the current tab (mail/phone handlers). */
export function opensInPlace(href: string): boolean {
  return /^(mailto:|tel:)/i.test(href);
}

/**
 * Ticker scroll duration: proportional to the text length so the speed stays the same as the
 * original (15s for the original 66 characters of text), with a floor for very short lists.
 */
export function tickerDuration(items: string[]): number {
  const chars = items.join('').length;
  return Math.max(6, Math.round((15 * chars) / 66));
}

export function linkLabel(link: ContactLink): string {
  return link.label || CONTACT_PLATFORMS[link.type]?.name || 'Link';
}

/** Public site settings (home hero, branding, contact panel, project CTA) + admin updates. */
@Injectable({ providedIn: 'root' })
export class SiteService {
  private http = inject(HttpClient);

  /**
   * One request per app instance (per SSR render / per browser session), shared by the
   * header, landing and project pages. Falls back to defaults on error.
   */
  readonly settings$: Observable<SiteSettings> = this.http.get<SiteSettings>(`${API_BASE}/settings`).pipe(
    catchError(() => of(FALLBACK_SETTINGS)),
    shareReplay(1),
  );

  /** Admin */
  adminSettings(): Observable<SiteSettings> {
    return this.http.get<SiteSettings>(`${API_BASE}/admin/settings`);
  }

  updateSettings(body: Partial<Pick<SiteSettings, 'homeHero' | 'branding' | 'ticker' | 'contact' | 'projectCta'>>): Observable<SiteSettings> {
    return this.http.put<SiteSettings>(`${API_BASE}/admin/settings`, body);
  }
}
