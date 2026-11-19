/**
 * Seeds projects from seed/project_data.json (the original UI JSON) plus the
 * hard-coded landing-page tiles. Idempotent: upserts by slug, so re-running
 * overwrites seeded projects with the JSON content.
 *
 *   npm run seed            # upsert
 *   npm run seed -- --fresh # delete all projects first
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { slugify } from '../src/lib/slugify.js';
import { ProjectModel } from '../src/modules/projects/project.model.js';

type LegacyType = 'singleImage' | 'doubleImage' | 'video' | 'doubleVideo';
interface LegacyProject {
  img: string;
  title: string;
  description: string;
  body: {
    heroImg: string;
    heroVideo: string;
    mainTitle: string;
    subtitle: string;
    client: string;
    Involvement: string[];
    result: string;
    contents: { type: LegacyType; urls: string[] }[];
  };
}

const IK = 'https://ik.imagekit.io/uhvinpqxo/New%20Warc%20Website/assets/images/LandingPage';

/** Landing tiles as they were hard-coded in landingpage.component.html (in order). */
const LANDING_TILES: { title: string; image: string; matchTitle?: string }[] = [
  { title: 'Studio Yellow Something', image: `${IK}/Yellow.png?updatedAt=1725350058962`, matchTitle: 'Studio Yellow Something' },
  { title: 'Bsmart by Bkash', image: `${IK}/bSmart2.png?updatedAt=1725350058947` },
  { title: 'LifeInRamadan', image: `${IK}/LinRamadan.png?updatedAt=1725350058104` },
  { title: 'BridgingBinaries', image: `${IK}/BBinaries.png?updatedAt=1725350059142` },
  { title: 'Coupon', image: `${IK}/Ecoupon.png?updatedAt=1725350058067` },
];

/**
 * - Some entries hold two URLs concatenated (".../file.mp4?updatedAt=123../../../assets/...") → keep the first.
 * - Local "../../../assets/..." paths become absolute on the public site so they work from any route / the admin.
 */
function fixUrl(raw: string): string {
  let u = (raw ?? '').trim();
  const glued = u.indexOf('../', 1);
  if (/^https?:\/\//.test(u) && glued > 0) u = u.slice(0, glued);
  const local = u.match(/^(?:\.\.\/)+assets\/(.*)$/);
  if (local) u = `${env.PUBLIC_SITE_URL}/assets/${encodeURI(local[1]!)}`;
  return u;
}

const kindOfLegacy = (t: LegacyType) => (t === 'video' || t === 'doubleVideo' ? 'video' : 'image');
const layoutOfLegacy = (t: LegacyType) => (t === 'doubleImage' || t === 'doubleVideo' ? 'split' : 'full');

function mapProject(p: LegacyProject, order: number) {
  return {
    slug: slugify(p.title),
    title: p.title,
    description: p.description ?? '',
    thumbnail: fixUrl(p.img),
    hero: { image: fixUrl(p.body.heroImg), video: fixUrl(p.body.heroVideo), poster: '' },
    mainTitle: p.body.mainTitle ?? '',
    subtitle: p.body.subtitle ?? '',
    client: p.body.client ?? '',
    involvement: (p.body.Involvement ?? []).filter(Boolean),
    result: p.body.result ?? '',
    blocks: (p.body.contents ?? []).map((c) => {
      const layout = layoutOfLegacy(c.type);
      const kind = kindOfLegacy(c.type);
      const urls = c.urls.slice(0, layout === 'split' ? 2 : 1);
      return { type: 'media', layout, items: urls.map((url) => ({ kind, url: fixUrl(url), alt: '' })) };
    }),
    status: 'published',
    listed: true,
    order,
    publishedAt: new Date(),
  };
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const here = dirname(fileURLToPath(import.meta.url));
  // Works from scripts/ (tsx) and from dist/scripts/ (compiled, inside Docker).
  const file = [join(here, '..', 'seed', 'project_data.json'), join(here, '..', '..', 'seed', 'project_data.json')].find(
    (f) => existsSync(f),
  );
  if (!file) throw new Error('seed/project_data.json not found');
  const json = JSON.parse(await readFile(file, 'utf8')) as { data: LegacyProject[] };

  await connectDb();
  if (fresh) {
    const { deletedCount } = await ProjectModel.deleteMany({});
    console.log(`--fresh: removed ${deletedCount} project(s)`);
  }

  const projects = json.data.map(mapProject);

  // Landing tiles: attach to an existing project or create a tile-only (unlisted) project.
  LANDING_TILES.forEach((tile, featuredOrder) => {
    const match = tile.matchTitle ? projects.find((p) => p.title === tile.matchTitle) : undefined;
    if (match) {
      Object.assign(match, { featured: true, featuredOrder, featuredImage: tile.image, featuredLabel: tile.title });
    } else {
      projects.push({
        ...mapProject(
          {
            img: tile.image,
            title: tile.title,
            description: '',
            body: { heroImg: tile.image, heroVideo: '', mainTitle: '', subtitle: '', client: '', Involvement: [], result: '', contents: [] },
          },
          projects.length,
        ),
        listed: false,
        featured: true,
        featuredOrder,
        featuredImage: tile.image,
        featuredLabel: tile.title,
      } as any);
    }
  });

  for (const p of projects) {
    await ProjectModel.updateOne({ slug: p.slug }, { $set: p, $inc: { __v: 1 } }, { upsert: true });
    console.log(`  ✓ ${p.slug}${(p as any).featured ? '  [featured]' : ''}${p.listed ? '' : '  [unlisted]'}`);
  }
  console.log(`Seeded ${projects.length} project(s).`);
  await disconnectDb();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
