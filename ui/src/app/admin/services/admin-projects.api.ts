import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../core/api/api.config';
import {
  AdminProject,
  AdminProjectInput,
  AdminProjectListItem,
  Paginated,
  ProjectStatus,
} from '../../core/models/project';

const BASE = `${API_BASE}/admin/projects`;

@Injectable({ providedIn: 'root' })
export class AdminProjectsApi {
  private http = inject(HttpClient);

  list(params: { search?: string; status?: ProjectStatus | ''; page?: number; limit?: number } = {}) {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') query[k] = String(v);
    return this.http.get<Paginated<AdminProjectListItem>>(BASE, { params: query });
  }

  get(id: string): Observable<AdminProject> {
    return this.http.get<AdminProject>(`${BASE}/${id}`);
  }

  create(body: AdminProjectInput): Observable<AdminProject> {
    return this.http.post<AdminProject>(BASE, body);
  }

  update(id: string, body: AdminProjectInput & { version: number }): Observable<AdminProject> {
    return this.http.put<AdminProject>(`${BASE}/${id}`, body);
  }

  patch(id: string, body: Partial<Pick<AdminProject, 'status' | 'listed' | 'featured'>>): Observable<AdminProject> {
    return this.http.patch<AdminProject>(`${BASE}/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }

  duplicate(id: string): Observable<AdminProject> {
    return this.http.post<AdminProject>(`${BASE}/${id}/duplicate`, {});
  }

  reorder(ids: string[]): Observable<void> {
    return this.http.put<void>(`${BASE}/reorder`, { ids });
  }

  reorderFeatured(ids: string[]): Observable<void> {
    return this.http.put<void>(`${BASE}/featured/reorder`, { ids });
  }

  slugAvailable(slug: string, excludeId?: string): Observable<boolean> {
    const params: Record<string, string> = { slug };
    if (excludeId) params['excludeId'] = excludeId;
    return this.http
      .get<{ available: boolean }>(`${BASE}/slug-available`, { params })
      .pipe(map((r) => r.available));
  }
}
