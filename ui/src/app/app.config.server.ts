import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';
import { API_ORIGIN } from './core/api/api.config';
import { environment } from '../environments/environment';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    // Where SSR fetches data from (e.g. http://api:5000 on the Docker network).
    // Set API_INTERNAL_URL in ui/.env (or container env); falls back to environment.ssrApiOrigin.
    { provide: API_ORIGIN, useFactory: () => process.env['API_INTERNAL_URL'] || environment.ssrApiOrigin },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
