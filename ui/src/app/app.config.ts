import { ApplicationConfig } from '@angular/core';
import { InMemoryScrollingFeature, InMemoryScrollingOptions, provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';

import { routes } from './app.routes';
import { apiBaseInterceptor } from './core/api/api-base.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';

const scrollConfig: InMemoryScrollingOptions = {
  scrollPositionRestoration: 'enabled',
  anchorScrolling: 'enabled',
};

const inMemoryScrollingFeature: InMemoryScrollingFeature = withInMemoryScrolling(scrollConfig);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, inMemoryScrollingFeature),
    // Hydration also caches GET responses made during SSR and replays them in the
    // browser, so public pages don't re-fetch their data after hydrating.
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptors([apiBaseInterceptor, authInterceptor])),
  ],
};
