import { cache, cached } from '../../lib/cache.js';
import { DEFAULT_TICKER, DEFAULT_BRANDING, DEFAULT_CONTACT, DEFAULT_HOME_HERO, DEFAULT_PROJECT_CTA, SettingsModel } from './settings.model.js';
import type { SettingsUpdate } from './settings.schema.js';

const KEY = 'site';
const CACHE_KEY = 'settings:public';

const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);

function serialize(doc: any) {
  const h = doc?.homeHero ?? {};
  const b = doc?.branding;
  const t = doc?.ticker;
  const c = doc?.contact;
  const p = doc?.projectCta;
  return {
    homeHero: {
      image: h.image || DEFAULT_HOME_HERO.image,
      mobileImage: h.mobileImage ?? '',
      video: h.video ?? '',
      poster: h.poster ?? '',
      alt: h.alt ?? '',
      buttonTopDesktop: typeof h.buttonTopDesktop === 'number' ? h.buttonTopDesktop : DEFAULT_HOME_HERO.buttonTopDesktop,
      buttonTopMobile: typeof h.buttonTopMobile === 'number' ? h.buttonTopMobile : DEFAULT_HOME_HERO.buttonTopMobile,
    },
    branding: {
      logo: b?.logo || DEFAULT_BRANDING.logo,
      favicon: str(b?.favicon, DEFAULT_BRANDING.favicon),
    },
    ticker: {
      items: Array.isArray(t?.items) ? t.items : DEFAULT_TICKER.items,
    },
    // An absent section (never saved) falls back to the defaults; saved values — including
    // empty strings or an empty link list — are respected.
    contact: {
      heading: str(c?.heading, DEFAULT_CONTACT.heading),
      text: str(c?.text, DEFAULT_CONTACT.text),
      links: Array.isArray(c?.links)
        ? c.links.map((l: any) => ({ type: l.type, url: l.url, label: l.label ?? '', icon: l.icon ?? '' }))
        : DEFAULT_CONTACT.links,
    },
    projectCta: {
      heading: str(p?.heading, DEFAULT_PROJECT_CTA.heading),
      lines: Array.isArray(p?.lines) ? p.lines : DEFAULT_PROJECT_CTA.lines,
      buttonLabel: str(p?.buttonLabel, DEFAULT_PROJECT_CTA.buttonLabel),
      buttonUrl: str(p?.buttonUrl, DEFAULT_PROJECT_CTA.buttonUrl),
    },
    updatedAt: doc?.updatedAt ?? null,
  };
}

/** Public settings (cached). Falls back to defaults when nothing has been saved yet. */
export function getPublic() {
  return cached(CACHE_KEY, async () => serialize(await SettingsModel.findOne({ key: KEY }).lean()));
}

export async function getAdmin() {
  return serialize(await SettingsModel.findOne({ key: KEY }).lean());
}

/** Replaces only the sections present in the input. */
export async function update(input: SettingsUpdate) {
  const $set: Record<string, unknown> = {};
  if (input.homeHero) $set['homeHero'] = input.homeHero;
  if (input.branding) $set['branding'] = input.branding;
  if (input.ticker) $set['ticker'] = input.ticker;
  if (input.contact) $set['contact'] = input.contact;
  if (input.projectCta) $set['projectCta'] = input.projectCta;
  const doc = await SettingsModel.findOneAndUpdate({ key: KEY }, { $set }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  cache.invalidatePrefix('settings:');
  return serialize(doc);
}

/** Used by media deletion to block removing files that settings still reference. */
export async function countUrlReferences(url: string): Promise<number> {
  return SettingsModel.countDocuments({
    $or: [
      { 'homeHero.image': url },
      { 'homeHero.mobileImage': url },
      { 'homeHero.video': url },
      { 'homeHero.poster': url },
      { 'contact.links.icon': url },
      { 'branding.logo': url },
      { 'branding.favicon': url },
    ],
  });
}
