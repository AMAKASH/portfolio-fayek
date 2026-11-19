import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import compression from 'compression';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';

/**
 * Where the API lives from the server's point of view (e.g. http://api:5000 on the Docker network).
 * Set in ui/.env (loaded by `npm run serve:ssr:portfolio-fayek`) or as a container env var.
 */
const API_INTERNAL_URL = process.env['API_INTERNAL_URL'] || 'http://localhost:5000';
/** Seconds to cache rendered public HTML in memory. 0 disables. */
const SSR_CACHE_TTL = Number(process.env['SSR_CACHE_TTL'] ?? 60);
const SSR_CACHE_MAX = 300;

const isAdmin = (url: string) => url === '/admin' || url.startsWith('/admin/') || url.startsWith('/admin?');

/** Tiny TTL+LRU cache for rendered HTML of public pages (renders are CPU-heavy). */
const htmlCache = new Map<string, { html: string; expires: number }>();
function cacheGet(key: string): string | undefined {
  const hit = htmlCache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    htmlCache.delete(key);
    return undefined;
  }
  htmlCache.delete(key); // refresh LRU position
  htmlCache.set(key, hit);
  return hit.html;
}
function cacheSet(key: string, html: string) {
  if (SSR_CACHE_TTL <= 0) return;
  htmlCache.set(key, { html, expires: Date.now() + SSR_CACHE_TTL * 1000 });
  while (htmlCache.size > SSR_CACHE_MAX) htmlCache.delete(htmlCache.keys().next().value!);
}

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.disable('x-powered-by');
  server.set('trust proxy', 1);
  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Same-origin API: the browser calls /api/... on this host and we forward it.
  // Keeps the refresh-token cookie first-party and avoids CORS entirely.
  server.use(
    createProxyMiddleware({
      target: API_INTERNAL_URL,
      changeOrigin: true,
      xfwd: true,
      pathFilter: '/api',
    }),
  );

  server.use(compression());

  server.get('/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok' });
  });

  // Hashed build assets are immutable; everything else (fonts, images in /assets) gets a day.
  server.get(
    '*.*',
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: false,
      setHeaders: (res, path) => {
        if (!/[.-][A-Z0-9]{8,}\.(js|css|mjs)$/i.test(path) && !path.includes('/media/')) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;
    const admin = isAdmin(originalUrl);

    if (admin) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    } else {
      // Browsers revalidate; a CDN/proxy in front may serve for 60s and refresh in the background.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
      const cached = cacheGet(originalUrl);
      if (cached) {
        res.setHeader('X-SSR-Cache', 'HIT');
        res.send(cached);
        return;
      }
    }

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => {
        if (!admin) cacheSet(originalUrl, html);
        res.send(html);
      })
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  const http = server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port} (API → ${API_INTERNAL_URL})`);
  });
  const shutdown = () => http.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

run();
