import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { FeaturedTile, ProjectCard, PublicProject } from '../models/project';

export type ProjectLookup = PublicProject | { redirect: { slug: string } };

/** Public, read-only project data. GETs are transferred from SSR to the browser by provideClientHydration(). */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);

  list(): Observable<ProjectCard[]> {
    return this.http.get<{ items: ProjectCard[] }>(`${API_BASE}/projects`).pipe(map((r) => r.items));
  }

  featured(): Observable<FeaturedTile[]> {
    return this.http.get<{ items: FeaturedTile[] }>(`${API_BASE}/projects/featured`).pipe(map((r) => r.items));
  }

  /** Numeric "slugs" (legacy /works/:idx URLs) come back as `{ redirect: { slug } }`. */
  bySlug(slug: string): Observable<ProjectLookup> {
    return this.http.get<ProjectLookup>(`${API_BASE}/projects/${encodeURIComponent(slug)}`);
  }
}
