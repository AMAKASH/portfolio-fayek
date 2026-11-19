import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { EMPTY, catchError, mergeMap, of } from 'rxjs';
import { PublicProject } from '../../core/models/project';
import { ProjectService } from '../../core/services/project.service';

/**
 * Loads the project before the page renders (so SSR outputs full content).
 * Legacy numeric URLs (/works/2) redirect to the slug; unknown slugs go back to /works.
 */
export const projectResolver: ResolveFn<PublicProject> = (route) => {
  const router = inject(Router);
  const slug = route.paramMap.get('slug') ?? '';
  return inject(ProjectService)
    .bySlug(slug)
    .pipe(
      mergeMap((res) => {
        if ('redirect' in res) {
          void router.navigate(['/works', res.redirect.slug], { replaceUrl: true });
          return EMPTY;
        }
        return of(res);
      }),
      catchError(() => {
        void router.navigate(['/works'], { replaceUrl: true });
        return EMPTY;
      }),
    );
};
