import { cache, cached } from '../../lib/cache.js';
import { DEFAULT_HOME_HERO, SettingsModel } from './settings.model.js';
import type { SettingsUpdate } from './settings.schema.js';

const KEY = 'site';
const CACHE_KEY = 'settings:public';

function serialize(doc: any) {
  const h = doc?.homeHero ?? {};
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

export async function update(input: SettingsUpdate) {
  const doc = await SettingsModel.findOneAndUpdate(
    { key: KEY },
    { $set: { homeHero: input.homeHero } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
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
    ],
  });
}
