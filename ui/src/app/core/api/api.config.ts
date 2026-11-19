import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Base URL for every API call — set per build in src/environments/*.ts (`apiUrl`).
 * Default '/api/v1' is same-origin:
 *  - browser: served by the SSR server's /api proxy (prod) or ng serve's proxy.conf.mjs (dev),
 *    so the refresh-token cookie is first-party and no CORS is involved.
 *  - server (SSR): relative URLs can't be fetched from Node, so `apiBaseInterceptor`
 *    prefixes them with API_ORIGIN (from API_INTERNAL_URL, see app.config.server.ts).
 */
export const API_BASE = environment.apiUrl.replace(/\/+$/, '');

/** Absolute origin of the API, used only during server-side rendering. */
export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN');
