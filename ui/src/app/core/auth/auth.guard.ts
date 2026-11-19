import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Admin guard. On the server we can't see the session (the access token is in
 * browser memory), so the server renders the admin shell's loading state and the
 * real check happens in the browser.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  if (isPlatformServer(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.ensureSession()) return true;
  return router.createUrlTree(['/admin/login'], { queryParams: { redirect: state.url } });
};

/** Keeps a logged-in admin away from the login page. */
export const guestGuard: CanActivateFn = async () => {
  if (isPlatformServer(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  return (await auth.ensureSession()) ? inject(Router).createUrlTree(['/admin/projects']) : true;
};
