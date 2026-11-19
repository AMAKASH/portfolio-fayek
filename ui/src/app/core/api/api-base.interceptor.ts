import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_ORIGIN } from './api.config';

/**
 * On the server, turn relative API URLs (`/api/...`) into `${API_ORIGIN}/api/...`.
 * No-op in the browser (token not provided) and for absolute URLs.
 */
export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  const origin = inject(API_ORIGIN, { optional: true });
  if (origin && req.url.startsWith('/') && !req.url.startsWith('//')) {
    return next(req.clone({ url: origin.replace(/\/+$/, '') + req.url }));
  }
  return next(req);
};
