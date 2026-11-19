/**
 * Moves legacy local media (files under ui/src/assets that the seed referenced as
 * http://localhost:4200/assets/... or /assets/...) to S3 + CloudFront, and rewrites every
 * reference in projects and site settings to the CDN URL.
 *
 * Why: ui/src/assets/images is git-ignored, so those files never reach the deployed site,
 * and absolute localhost URLs make browsers show a "local network access" prompt.
 *
 *   npm run migrate:assets                 # dry run: report what would change
 *   npm run migrate:assets -- --apply      # upload + rewrite
 *   npm run migrate:assets -- --apply --assets-dir=../ui/src/assets
 *
 * Idempotent: already-migrated URLs no longer match, and uploads use deterministic keys.
 */
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { bucket, getS3, publicUrlForKey } from '../src/lib/s3.js';
import { MediaModel } from '../src/modules/media/media.model.js';
import { UPLOAD_CACHE_CONTROL } from '../src/modules/media/media.service.js';
import { ProjectModel } from '../src/modules/projects/project.model.js';
import { SettingsModel } from '../src/modules/settings/settings.model.js';

const apply = process.argv.includes('--apply');
const assetsDirArg = process.argv.find((a) => a.startsWith('--assets-dir='))?.split('=')[1];
const ASSETS_DIR = resolve(assetsDirArg ?? '../ui/src/assets');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

/** Matches http(s)://localhost[:port]/assets/x, 127.0.0.1, the old PUBLIC_SITE_URL, and root-relative /assets/x. */
function localAssetPath(url: string): string | null {
  const m =
    url.match(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/assets\/(.+)$/i) ??
    (env.PUBLIC_SITE_URL ? url.match(new RegExp(`^${env.PUBLIC_SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/assets/(.+)$`)) : null) ??
    url.match(/^\/assets\/(.+)$/);
  if (!m) return null;
  try {
    return decodeURI(m[1]!.split(/[?#]/)[0]!);
  } catch {
    return m[1]!;
  }
}

/** Deep-maps every string in a plain object/array. */
function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === 'object' && !(value instanceof Date) && value.constructor?.name !== 'ObjectId') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
    return out as T;
  }
  return value;
}

function collect(value: unknown, into: Set<string>) {
  mapStrings(value, (s) => {
    if (localAssetPath(s)) into.add(s);
    return s;
  });
}

async function main() {
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — assets dir: ${ASSETS_DIR}`);
  if (!existsSync(ASSETS_DIR)) throw new Error(`Assets dir not found: ${ASSETS_DIR} (pass --assets-dir=...)`);
  await connectDb();

  const projects = await ProjectModel.find().lean();
  const settings = await SettingsModel.find().lean();
  const urls = new Set<string>();
  projects.forEach((p) => collect(p, urls));
  settings.forEach((s) => collect(s, urls));

  if (!urls.size) {
    console.log('Nothing to migrate: no local asset URLs found.');
    await disconnectDb();
    return;
  }

  // Plan: one upload per distinct local file.
  const byPath = new Map<string, { file: string; size: number; mime: string; key: string; urls: string[] }>();
  const missing: string[] = [];
  for (const url of urls) {
    const rel = localAssetPath(url)!;
    const file = resolve(ASSETS_DIR, rel);
    if (!file.startsWith(ASSETS_DIR) || !existsSync(file)) {
      missing.push(`${url}  (looked for ${file})`);
      continue;
    }
    const mime = MIME[extname(file).toLowerCase()];
    if (!mime) {
      missing.push(`${url}  (unsupported type)`);
      continue;
    }
    const entry = byPath.get(rel) ?? {
      file,
      size: statSync(file).size,
      mime,
      key: `${env.S3_PREFIX}/legacy/${rel.split('/').map((s) => s.replace(/\s+/g, '-')).join('/')}`,
      urls: [],
    };
    entry.urls.push(url);
    byPath.set(rel, entry);
  }

  let total = 0;
  for (const [rel, e] of byPath) {
    total += e.size;
    console.log(`  ${(e.size / 1048576).toFixed(1).padStart(6)} MB  ${rel}  →  ${publicUrlForKey(e.key)}`);
  }
  console.log(`${byPath.size} file(s), ${(total / 1048576).toFixed(1)} MB total, referenced by ${urls.size} URL variant(s).`);
  if (missing.length) {
    console.log(`\n${missing.length} URL(s) can't be migrated (left unchanged):`);
    missing.forEach((m) => console.log('  - ' + m));
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to upload and rewrite.');
    await disconnectDb();
    return;
  }

  // Upload + register in the media library.
  const replace = new Map<string, string>();
  for (const [rel, e] of byPath) {
    const body = await readFile(e.file);
    await getS3().send(
      new PutObjectCommand({ Bucket: bucket(), Key: e.key, Body: body, ContentType: e.mime, CacheControl: UPLOAD_CACHE_CONTROL }),
    );
    const cdn = publicUrlForKey(e.key);
    await MediaModel.updateOne(
      { key: e.key },
      {
        $set: {
          url: cdn,
          kind: e.mime.startsWith('video/') ? 'video' : 'image',
          mime: e.mime,
          size: e.size,
          originalName: rel.split('/').pop(),
        },
      },
      { upsert: true },
    );
    e.urls.forEach((u) => replace.set(u, cdn));
    console.log(`  ✓ uploaded ${rel}`);
  }

  // Rewrite references.
  const swap = (s: string) => replace.get(s) ?? s;
  let changedProjects = 0;
  for (const p of projects) {
    const { _id, __v, createdAt, updatedAt, ...rest } = p as any;
    const next = mapStrings(rest, swap);
    if (JSON.stringify(next) === JSON.stringify(rest)) continue;
    // bump __v so any editor open on the old version gets a conflict instead of writing localhost URLs back
    await ProjectModel.updateOne({ _id }, { $set: next, $inc: { __v: 1 } });
    changedProjects++;
  }
  let changedSettings = 0;
  for (const s of settings) {
    const { _id, __v, createdAt, updatedAt, ...rest } = s as any;
    const next = mapStrings(rest, swap);
    if (JSON.stringify(next) === JSON.stringify(rest)) continue;
    await SettingsModel.updateOne({ _id }, { $set: next });
    changedSettings++;
  }
  console.log(`\nRewrote ${changedProjects} project(s) and ${changedSettings} settings doc(s).`);
  console.log('Restart the API (or wait PUBLIC_CACHE_TTL_SECONDS) so cached responses refresh.');
  await disconnectDb();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
