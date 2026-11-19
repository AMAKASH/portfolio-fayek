import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { AuthService } from './auth.service';

const ADMIN_PREFIX = `${API_BASE}/admin`;

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/** Attaches the access token to admin API calls; on 401 refreshes once and retries. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(ADMIN_PREFIX)) return next(req);
  const auth = inject(AuthService);

  return next(withToken(req, auth.token)).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) return throwError(() => err);
      return from(auth.refresh()).pipe(
        switchMap((ok) => {
          if (!ok) {
            void auth.expire();
            return throwError(() => err);
          }
          return next(withToken(req, auth.token));
        }),
      );
    }),
  );
};
