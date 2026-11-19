/**
 * DEVELOPMENT settings (`ng serve`, `ng build --configuration development`).
 * Swapped in for environment.ts via fileReplacements in angular.json.
 * The dev proxy target (where /api is forwarded) is set in `ui/.env` → API_INTERNAL_URL.
 */
export const environment = {
  production: false,

  /** '/api/v1' goes through ng serve's proxy (proxy.conf.mjs). Use an absolute URL to bypass it. */
  apiUrl: '/api/v1',

  /** API origin used by the dev server's SSR pass when API_INTERNAL_URL isn't set. */
  ssrApiOrigin: 'http://localhost:5000',

  siteTitle: 'Fayek Al Rafi',
};
