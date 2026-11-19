# portfolio-fayek-api

Express 5 + TypeScript (ESM, `NodeNext`) + MongoDB/Mongoose 8 API for the portfolio site in `../ui`. It serves the project/case-study content (previously a JSON file in the UI) and powers the admin panel at `/admin`. Media is uploaded **directly from the browser to S3** (presigned POST) and served through CloudFront.

## Commands
- `npm run dev`: `tsx watch` with `.env` (port `PORT`, default 5000)
- `npm run build`: `tsc -p tsconfig.build.json` → `dist/src`, `dist/scripts`
- `npm start`: `node dist/src/server.js`
- `npm test`: vitest + supertest + mongodb-memory-server (S3 mocked). The first run downloads a mongod binary.
- `npm run typecheck`: also typechecks tests.
- `npm run seed`: upsert projects from `seed/project_data.json` plus the landing tiles. `-- --fresh` wipes the projects first.
- `npm run admin:create -- <email> <password>`: create or reset the single admin. Resetting revokes all sessions.
- `npm run db:indexes`: `syncIndexes()` for all models. Run this in prod, where `autoIndex` is off.
- Compiled equivalents for use inside Docker: `seed:prod`, `admin:create:prod`, `db:indexes:prod`.

## Layout
```
src/
  server.ts        bootstrap: connect DB → bootstrapAdmin → listen; graceful SIGTERM shutdown
  app.ts           express app factory (helmet, cors, compression, pino-http, rate limit, routes, errors)
  routes.ts        mounts /api/v1 (public routers directly, admin routers under /admin behind requireAuth)
  config/env.ts    zod-validated env (process exits on invalid config). Always import `env` from here.
  config/db.ts     mongoose connect (pool size, autoIndex off in production)
  lib/             logger (pino), HttpError, cache (LRU + in-flight dedupe), s3 client, slugify
  middleware/      validate(zod), requireAuth (Bearer JWT), errorHandler/notFound, rate limiters, cache headers
  modules/<name>/  <name>.model|schema|service|controller|routes.ts
    auth/          login / refresh / logout / me / password
    users/         User model (single admin)
    projects/      Project model, public + admin routers
    media/         presign / confirm / library / delete
    settings/      single `Settings` doc (key 'site'): home hero, branding, contact panel, project CTA
    health/        GET /health (pings Mongo; used by the Docker HEALTHCHECK)
scripts/           seed-projects, create-admin, sync-indexes
seed/              project_data.json (original UI JSON; it's inside the API so the Docker build context has it)
test/              setup.ts (memory Mongo + env), helpers.ts, *.test.ts
```
**Adding a module:**
1. Create `src/modules/<name>/` with model, zod schema, service (the logic), controller (thin) and routes.
2. Mount the router in `src/routes.ts`.
3. Admin routes go on the `admin` router, which already applies `noStore` and `requireAuth`.

Express 5 forwards rejected promises to `errorHandler`, so controllers don't need try/catch. Throw an `HttpError` for any 4xx.

`validate()` replaces `req.body` with the parsed value. Parsed query params go on `req.validQuery` (read them with `q(req, schema)`), because Express 5's `req.query` is read-only.

## Data model
**Project** ([project.model.ts](src/modules/projects/project.model.ts)), `optimisticConcurrency: true`:
- Identity and basics:
  - `slug`: unique, used in the URL `/works/:slug`
  - `title`, `description` (the category label, e.g. "(Film Studio)"), `thumbnail` (works grid image)
- Case study:
  - `hero {image, video, poster}`. The hero video plays; the image is the fallback and the "next project" preview.
  - `mainTitle`, `subtitle`, `client`, `involvement[]` (any length), `result`
  - `blocks[]` (ordered, see below)
- Publishing and ordering:
  - `status`: `draft` or `published`
  - `listed`: whether it appears in the works grid
  - `order`: grid order and prev/next order
- Landing tile: `featured`, `featuredOrder`, `featuredImage`, `featuredLabel`
- `seo {metaTitle, metaDescription, ogImage}`, `publishedAt`, timestamps

**Blocks** (zod union in [project.schema.ts](src/modules/projects/project.schema.ts); one Mongoose subschema with `_id`, exposed as `id`):
- `{type:'media', layout:'full'|'split', items: MediaItem[1|2], caption?}`. `full` takes exactly 1 item and `split` exactly 2, and the two items can be image + video.
  - Mapping from the old JSON: `singleImage`/`video` became `full`, and `doubleImage`/`doubleVideo` became `split`.
- `{type:'text', heading?, body}`
- `MediaItem = {kind:'image'|'video', url, alt, poster?, width?, height?, mediaId?}`

**Versioning:** the admin `PUT` must send `version` (the `__v` returned by every admin read). A stale version returns **409 `VERSION_CONFLICT`**.
- `PATCH` toggles also bump the version.
- `reorder` does not bump it, because order isn't part of the editor form.

**User:** `{email, passwordHash (select:false), tokenVersion, lastLoginAt}`. Exactly one document.

**Media:** `{key, url, kind, mime, size, width, height, duration, alt, originalName}`. This is the library of uploaded S3 objects.

## Endpoints (`/api/v1`)
**Public** (published only; `Cache-Control: public, max-age=TTL, swr`; weak ETag → 304):

| Endpoint | Returns |
|---|---|
| `GET /projects` | Cards `{slug,title,description,thumbnail}`, listed only, by `order` |
| `GET /projects/featured` | `{slug,title,image,hasDetails}` by `featuredOrder`. `hasDetails=false` means no blocks, so the tile isn't linked. |
| `GET /projects/:slug` | Full public project plus `prev`/`next` `{slug,title,heroImage,thumbnail}`, wrapping around within listed projects. A numeric `:slug` (legacy `/works/:idx`) returns `{redirect:{slug}}`. |

**Auth:**

| Endpoint | Notes |
|---|---|
| `POST /auth/login` | 5/min/IP. Returns `{accessToken, user}` and sets the `pf_rt` cookie. |
| `POST /auth/refresh` | Rotates the cookie and returns a new access token. |
| `POST /auth/logout` | Bumps `tokenVersion`, which revokes all refresh tokens. |
| `GET /auth/me` | |
| `PATCH /auth/password` | Revokes the other sessions and returns a fresh session. |

**Admin** (`Authorization: Bearer <access>`, `no-store`):

*Projects*

| Endpoint | Purpose |
|---|---|
| `GET /admin/projects?search=&status=&page=&limit=` | List, including drafts |
| `POST /admin/projects` | Create |
| `GET /admin/projects/:id` | Read one |
| `PUT /admin/projects/:id` | Full replace, with `version` |
| `PATCH /admin/projects/:id` | `{status?, listed?, featured?}` |
| `DELETE /admin/projects/:id` | Delete |
| `POST /admin/projects/:id/duplicate` | Copy (as a draft) |
| `PUT /admin/projects/reorder` | `{ids[]}` |
| `PUT /admin/projects/featured/reorder` | `{ids[]}` |
| `GET /admin/projects/slug-available?slug=&excludeId=` | Slug check |

*Media*

| Endpoint | Purpose |
|---|---|
| `GET /admin/media/config` | `{enabled, allowedTypes, maxImageBytes, maxVideoBytes}` |
| `POST /admin/media/presign` | `{filename, contentType, size}` → `{upload:{url,fields}, key, publicUrl, ...}` |
| `POST /admin/media` | Confirm `{key, originalName, alt?, width?, height?, duration?}`: HeadObject, then upsert the Media doc |
| `GET /admin/media?kind=&search=&page=` | Library list |
| `PATCH /admin/media/:id` | `{alt}` |
| `DELETE /admin/media/:id` | Returns 409 `MEDIA_IN_USE` if any project references the URL |

**Settings** (`settings` module):

| Endpoint | Purpose |
|---|---|
| `GET /settings` | Public, cached. Returns `{homeHero, branding:{logo,favicon}, contact:{heading,text,links[{type,url,label,icon}]}, projectCta:{heading,lines[],buttonLabel,buttonUrl}}`. |
| `GET/PUT /admin/settings` | Admin read and update. `PUT` is partial: only the sections sent are replaced. Hero positions are 0–100 (%). Custom links require `icon`. |

Sections never saved fall back to the `DEFAULT_*` constants in [settings.model.ts](src/modules/settings/settings.model.ts). Saved values, including empty strings and empty lists, are respected.

Media deletion also checks settings references.

**Errors** are always `{error:{message, code?, details?}}`. Zod failures return 400 `VALIDATION` with `details[{path,message}]`, and duplicate keys return 409 `DUPLICATE`.

## Auth flow
- The access JWT (`ACCESS_TTL`, default 15m) is kept **in browser memory only**.
- The refresh JWT is an httpOnly cookie `pf_rt` with `Path=/api/v1/auth` and `SameSite=Lax`. It is `Secure` in production and lasts `REFRESH_TTL_DAYS`. It is rotated on every refresh.
- Revocation works by comparing `tokenVersion` (no token table).
- `requireAuth` is stateless (no DB lookup).
- The UI calls the API **same-origin**: the SSR server proxies `/api`, and in dev ng serve's `proxy.conf.mjs` does it. That keeps the cookie first-party.
- If the API is ever called cross-site instead, cookies need `SameSite=None; Secure` and `CORS_ORIGINS` must list the origin. `COOKIE_DOMAIN` covers sibling subdomains.
- **First boot:** if there are no users and `ADMIN_EMAIL`/`ADMIN_PASSWORD` (≥10 chars) are set, the admin is created. It is never overwritten; use `admin:create` to change it.

## Uploads (S3 + CloudFront)
**Flow:**
1. The browser calls `presign`.
2. The browser sends a multipart POST straight to S3 (with progress), putting the `fields` first and the `file` last.
3. The browser calls `confirm`, sending the width, height and duration it measured.

**Rules:**
- The presign policy pins `content-length-range` (`MAX_IMAGE_MB`/`MAX_VIDEO_MB`), `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`.
- Keys look like `${S3_PREFIX}/yyyy/mm/<uuid>-<slug>.<ext>` and are immutable.
- Public URL: `${CLOUDFRONT_URL}/<key>`.
- Allowed types: jpeg, png, webp, avif, gif, svg, mp4, webm, quicktime.

**AWS setup:**
- The **bucket CORS** must allow `POST` from the site origin, for example:
  ```json
  [{"AllowedOrigins":["https://your-site.com","http://localhost:4200"],"AllowedMethods":["POST"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]
  ```
- The bucket can stay private if CloudFront reads it through OAC.
- The IAM user or role needs `s3:PutObject`, `s3:GetObject` (HeadObject) and `s3:DeleteObject` on `arn:aws:s3:::BUCKET/PREFIX/*`.
- Without `S3_BUCKET` + `CLOUDFRONT_URL`, the media endpoints return 503 and `config.enabled=false`. Pasting URLs still works.

## Caching and performance
- **Public endpoint cache:** an in-memory LRU ([lib/cache.ts](src/lib/cache.ts)) with TTL `PUBLIC_CACHE_TTL_SECONDS` (0 disables) and in-flight de-duplication. Every admin write calls `invalidatePublic()`.
  - **Scripts (`seed`) write to Mongo directly and don't invalidate it**: restart the API or wait out the TTL.
  - With several replicas, swap the `Cache` implementation for Redis.
- **Queries:**
  - Lists use `lean()` with projections.
  - Prev/next uses two indexed queries.
  - Indexes: `{slug}` unique, `{status,listed,order}`, `{status,featured,featuredOrder}`, `{order}`.
- **Server:** the JSON body limit is 1mb (media never passes through the API), and `trust proxy` is set to `TRUST_PROXY` (Traefik = 1). `keepAliveTimeout` is 65s.

## Env
- See [.env.example](.env.example). It is validated in [src/config/env.ts](src/config/env.ts).
- Required: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (each ≥32 chars).
- Temporary STS credentials also need `AWS_SESSION_TOKEN`.

## Seed
- [scripts/seed-projects.ts](scripts/seed-projects.ts) maps the old JSON to the new model and upserts by slug, so it's idempotent.
- URLs are kept as they are, with two fixes:
  - Concatenated double URLs are cut at `../`.
  - Local `../../../assets/...` paths become `${PUBLIC_SITE_URL}/assets/...`.
- It also creates the landing tiles that existed only in HTML (Bsmart by Bkash, LifeInRamadan, BridgingBinaries, Coupon). They are `featured`, `listed:false` and have no blocks yet, so their tiles aren't clickable.

## Docker / Dokploy
- `Dockerfile`: a multi-stage `node:22-alpine` build that runs as non-root `node`, with a `HEALTHCHECK` on `/health`, on port 5000.
- Run the one-off commands in the container, e.g. `node dist/scripts/seed-projects.js`.
- Put env vars in Dokploy (never in the image).
- In prod, run `db:indexes:prod` once after the first deploy, or set `MONGO_AUTO_INDEX=true`.
- The UI container reaches the API at `API_INTERNAL_URL` (e.g. `http://api:5000`), so the API doesn't need a public domain.

## Ignore
`node_modules/` and `dist/`.
