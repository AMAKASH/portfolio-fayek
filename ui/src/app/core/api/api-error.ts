import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody } from '../models/project';

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Check your connection.';
    const body = err.error as ApiErrorBody | undefined;
    const details = body?.error?.details;
    if (Array.isArray(details) && details.length) {
      return `${body!.error.message}: ${details
        .slice(0, 3)
        .map((d: { path?: string; message?: string }) => (d.path ? `${d.path} — ${d.message}` : d.message))
        .join('; ')}`;
    }
    return body?.error?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function apiErrorCode(err: unknown): string | undefined {
  return err instanceof HttpErrorResponse ? (err.error as ApiErrorBody | undefined)?.error?.code : undefined;
}
