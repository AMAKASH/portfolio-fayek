/**
 * PRODUCTION build settings (`ng build`, the default configuration).
 * Baked into the bundle at build time — rebuild after changing.
 * Runtime/server settings (port, internal API address, SSR cache) live in `ui/.env`.
 */
export const environment = {
  production: true,

  /**
   * Base URL the BROWSER uses for the API.
   * - '/api/v1' (recommended): same-origin; the SSR server proxies /api → API_INTERNAL_URL.
   *   No CORS, and the admin refresh cookie stays first-party.
   * - 'https://api.example.com/api/v1': call the API directly (cross-origin). Then the API's
   *   CORS_ORIGINS must include the site origin, and cookies must work cross-site.
   */
  apiUrl: '/api/v1',

  /** Fallback API origin used during server-side rendering when API_INTERNAL_URL isn't set. */
  ssrApiOrigin: 'http://localhost:5000',

  /** Appended to page titles, e.g. "Chillox | WARC LTD." */
  siteTitle: 'WARC LTD.',
};
