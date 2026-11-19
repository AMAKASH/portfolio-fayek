# portfolio-fayek

Angular 17 portfolio site: standalone components, SSR via `@angular/ssr` with an Express server, originally the WARC Ltd. agency site.

- **Project content comes from the API in `../api`** (see `../api/CLAUDE.md`). The old `project_data.json` now lives only in `api/seed/`.
- The admin panel for managing projects is part of this app, at `/admin`.

## Commands
- `npm start` / `npm run dev`: `ng serve` at http://localhost:4200.
  - Needs the API running on `localhost:5000`. [proxy.conf.mjs](proxy.conf.mjs) forwards `/api` to `API_INTERNAL_URL` from `.env`.
  - **Restart ng serve after editing `angular.json`, `proxy.conf.mjs` or `.env`.**
- `npm run build`: production build to `dist/build/{browser,server}`. Prerender is **off**: pages are dynamic and SSR'd at runtime.
- `npm run serve:ssr:portfolio-fayek`: runs `dist/build/server/server.mjs` (port `PORT`, default 4000).
  - The bundle includes its dependencies, so no `node_modules` is needed at runtime.
- `npm test`: Karma/Jasmine (boilerplate only).
- The Angular project name is `portfolio-fayek`.

## Configuration
**Build-time** (baked into the bundle; rebuild after changing):
- [src/environments/environment.ts](src/environments/environment.ts) is used for production builds.
- [environment.development.ts](src/environments/environment.development.ts) is used by `ng serve` and development builds, via `fileReplacements`.

| Field | Purpose |
|---|---|
| `apiUrl` | API base URL used by the browser. Default `/api/v1` (same-origin through the proxy). An absolute URL calls the API cross-origin; then the API's `CORS_ORIGINS` must allow the site. |
| `ssrApiOrigin` | Fallback API origin for SSR when `API_INTERNAL_URL` is unset |
| `siteTitle` | Page title suffix |

**Runtime**: `ui/.env` (git-ignored; template in [.env.example](.env.example)). It is read by `serve:ssr` (`node --env-file-if-exists=.env`) and by [proxy.conf.mjs](proxy.conf.mjs) (the ng serve proxy). In Docker or Dokploy, set container env vars instead.

| Var | Default | Purpose |
|---|---|---|
| `PORT` | 4000 | SSR server port |
| `API_INTERNAL_URL` | `http://localhost:5000` | API origin used by SSR data fetches **and** the `/api` proxy (prod and dev), e.g. `http://api:5000` in Docker |
| `SSR_CACHE_TTL` | 60 | Seconds to cache rendered public HTML in memory (0 = off) |

## Data flow
- Every call uses a relative `/api/v1/...` URL ([core/api/api.config.ts](src/app/core/api/api.config.ts)).
  - In the browser, [server.ts](server.ts) proxies `/api` to the API in production, and `proxy.conf.mjs` does it in dev. This keeps calls same-origin, so there's no CORS and the refresh cookie is first-party.
  - On the server, `apiBaseInterceptor` prefixes `API_ORIGIN`, which is provided in [app.config.server.ts](src/app/app.config.server.ts) from `API_INTERNAL_URL`.
- `provideClientHydration()` transfers SSR GET responses to the browser, so pages don't re-fetch after hydrating.
- Public data goes through [core/services/project.service.ts](src/app/core/services/project.service.ts): `list()`, `featured()`, `bySlug()`.
- Types: [core/models/project.ts](src/app/core/models/project.ts), which mirrors the API.

## Routes ([src/app/app.routes.ts](src/app/app.routes.ts))
| Path | Component | Notes |
|---|---|---|
| `admin/**` | lazy `admin/admin.routes.ts` | Outside the public layout. See Admin below. |
| `''` | HomeComponent → `<app-landingpage>` | Tiles from `GET /projects/featured` |
| `about` | TeamPageComponent | Static |
| `works` | AllProjectsComponent | Grid from `GET /projects` |
| `works/:slug` | ProjectDetailsComponent | `projectResolver` loads the data before render. Numeric `:slug` (old `/works/:idx` links) redirects to the slug; unknown slugs go to `/works`. Sets title and meta from `seo`. |
| `**` | redirect to `''` | |

Public routes are lazy children of `PagesComponent` (`<app-header>` + outlet). The header links to `/home`, which falls through `**` to `''`.

## Where to edit what
- **Project content** (titles, client, involvement, results, media, block order, landing tiles, SEO): **use the admin panel**, not code.
- **The case-study layout** (hero, info panel, blocks): [shared/project-view/](src/app/shared/project-view/).
  - Used by both the public details page and the admin live preview.
  - Its SCSS uses **container queries** (`@container pv (max-width: …)`) instead of media queries, so the preview frame can render true mobile and desktop layouts. Keep it that way.
  - Block types:
    - `media` + `full`: `.singleImage` for an image, `.bigVideo` for a video
    - `media` + `split`: `.doubleImage` when both items are images; `.doubleVideo` with `.videoChild` for two videos or a mixed pair
    - `text`: `.textBlock`
  - Below-the-fold videos use [AutoplayInViewDirective](src/app/shared/autoplay-in-view.directive.ts), which plays them only while visible. Images are `loading="lazy"`.
- **Details page chrome** (contact CTA, previous/next preview): [pages/project-details/](src/app/pages/project-details/). Prev/next comes from the API, ordered by the admin order, and wraps around.
- **Header / nav / contact panel / social buttons / marquees**: [core/header/](src/app/core/header/).
  - Nav labels and paths are the `items` and `paths` arrays in `header.component.ts`.
  - Social `href`s are empty.
- **Landing page**: [landingpage.component.html](src/app/pages/home/landingpage/landingpage.component.html).
  - The hero image is hard-coded.
  - The tiles loop over the featured projects; a tile links only when `hasDetails`.
  - The "All Projects" button links to `/works`.
- **About/Team page**: [team-page.component.html](src/app/pages/team-page/team-page.component.html), still hard-coded.
  - Each member is a `<swiper-slide>` preceded by a `<!-- Name -->` comment.
  - Photos are in `src/assets/images/TeamsPage/teamMembers/`.
- **Page title / favicon**: [src/index.html](src/index.html) (title "WARC LTD."), `src/favicon.ico`.

## Admin panel (`src/app/admin/`)
**How it loads:**
- It's a lazy chunk, so none of its code or CSS loads for public visitors.
- [AdminRootComponent](src/app/admin/admin-root.component.ts):
  - holds the admin design system ([admin.scss](src/app/admin/admin.scss)), unencapsulated and scoped under `.adm`, with classes like `.btn`, `.input`, `.card`, `.field`, `.switch`, `.pill`, `.banner`, `.dialog`
  - sets `ngSkipHydration`
  - renders the outlet **only in the browser**; the server renders a spinner, and `server.ts` sends `no-store` + `noindex` for `/admin`
- No UI library is used: there's a small inline SVG icon set ([shared/icon.component.ts](src/app/admin/shared/icon.component.ts)), and `@angular/cdk` handles drag & drop.

**Auth** ([core/auth/](src/app/core/auth/)):
- `AuthService` keeps the access token in memory. It restores the session from the httpOnly refresh cookie (`ensureSession`) and de-duplicates refreshes.
- `authInterceptor` adds the Bearer token to `/api/v1/admin/*` and retries once after a refresh on a 401.
- Guards: `authGuard` / `guestGuard`.

**Pages:**
- **Projects** (`/admin/projects`):
  - search and status filter
  - drag-reorder (sets grid and prev/next order; only when unfiltered)
  - inline publish, grid and landing toggles
  - duplicate and delete
- **Editor** (`/admin/projects/new|:id`, [projects/editor/](src/app/admin/projects/editor/)):
  - **Form:** typed reactive form in [project-form.ts](src/app/admin/projects/editor/project-form.ts), which handles form ↔ API mapping, block presets and the preview mapping.
  - **Tabs:** Details, Hero, Content (block builder: add, insert-between, drag/↑↓, duplicate, collapse, full↔split, image/video per slot, captions, text blocks), Listing & landing, SEO.
  - **Live preview:** `PreviewFrameComponent` renders `ProjectViewComponent` at 1440px or 390px, scaled to fit.
  - **Saving:** save draft / publish / unpublish, Ctrl+S, an unsaved-changes guard plus `beforeunload`, and a 409 conflict banner (reload or overwrite).
  - **Slug:** generated from the title on new projects, with a live availability check.
- **[MediaFieldComponent](src/app/admin/projects/editor/media-field.component.ts)**: one media slot. It takes drag-drop, upload with progress, a library pick or a pasted URL, plus alt text and a video poster.
  - The upload path is [UploadService](src/app/admin/services/upload.service.ts): presign, then POST to S3 through `HttpBackend` (no interceptors), then confirm with the dimensions measured in the browser.
- **Landing tiles** (`/admin/featured`): order the tiles and add or remove them.
- **Media library** (`/admin/media`): multi-file upload (3 at a time, drop anywhere), filter and search, alt text, copy URL, delete (blocked while in use).
- **Account** (`/admin/account`): change password.

## Styling
- Each public component has its own large `.scss` file.
- Global styles: [src/styles.scss](src/styles.scss) imports `src/theme/_base.scss` (reset: `img`/`a` are `display:block`, and `.container`), `_fonts.scss` (NeueMontreal: `NeueReg`, `NeueMed`, `NeueItalic`) and `_variables.scss`.
- `src/theme/_swipper.scss` holds the Swiper overrides. `swiper-bundle.min.css` is global via `angular.json`.
- PrimeNG is installed but unused.

## Cross-cutting behavior
- `ObserverService.footerObserver`: the landing and team pages observe `#footer` and the header expands into the contact panel.
- Swiper is used as web components registered in `src/main.ts`, with `CUSTOM_ELEMENTS_SCHEMA`. They are `init="false"` and initialized manually.
- **SSR:**
  - Guard browser-only APIs with `typeof document !== 'undefined'`, `afterNextRender` or `isPlatformBrowser`.
  - [server.ts](server.ts) also:
    - serves `/health`
    - compresses responses
    - caches public HTML (`X-SSR-Cache: HIT`)
    - caches static assets (hashed bundles for 1y, immutable; `/assets` for 1 day)
  - Rendered public HTML is cached for `SSR_CACHE_TTL`, so admin edits can take up to that long (plus the API cache TTL) to appear.
- **Angular 17 compiler gotcha:** don't use `??` inside an `@for ... track` expression. It compiles to an undeclared temp variable and the render fails with `ReferenceError: tmp_N_M is not defined`. Use `||` or a method instead.

## Assets
- Legacy images and videos are on the ImageKit CDN (`https://ik.imagekit.io/uhvinpqxo/...`) or in `src/assets/images/<Project>/`. Seeded local paths are absolute `${PUBLIC_SITE_URL}/assets/...` URLs.
- New uploads go to S3 and are served via CloudFront.
- Filenames contain spaces and dots (e.g. `1. Chillox.mov`).
- Fonts are in `src/assets/Fonts/NeueMontreal/`.

## Docker / Dokploy
- `Dockerfile`: multi-stage; the runtime image holds only `dist/build`. Port 4000, `HEALTHCHECK /health`.
- Set `API_INTERNAL_URL` to the API service's internal address.
- Only the UI needs a public domain: the API is reached through the `/api` proxy.

## Ignore
`node_modules/`, `.angular/` (cache) and `dist/` (build output) are generated.
