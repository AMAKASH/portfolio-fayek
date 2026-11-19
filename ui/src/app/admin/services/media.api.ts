import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { API_BASE } from '../../core/api/api.config';
import { MediaAsset, MediaKind, Paginated } from '../../core/models/project';

const BASE = `${API_BASE}/admin/media`;

export interface MediaConfig {
  enabled: boolean;
  allowedTypes: string[];
  maxImageBytes: number;
  maxVideoBytes: number;
}

export interface PresignResult {
  upload: { url: string; fields: Record<string, string> };
  key: string;
  publicUrl: string;
  kind: MediaKind;
  maxBytes: number;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class MediaApi {
  private http = inject(HttpClient);
  private config$?: Observable<MediaConfig>;

  config(): Observable<MediaConfig> {
    return (this.config$ ??= this.http.get<MediaConfig>(`${BASE}/config`).pipe(shareReplay(1)));
  }

  list(params: { kind?: MediaKind | ''; search?: string; page?: number; limit?: number } = {}) {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') query[k] = String(v);
    return this.http.get<Paginated<MediaAsset>>(BASE, { params: query });
  }

  presign(file: File): Observable<PresignResult> {
    return this.http.post<PresignResult>(`${BASE}/presign`, {
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
  }

  confirm(body: {
    key: string;
    originalName: string;
    alt?: string;
    width?: number;
    height?: number;
    duration?: number;
  }): Observable<MediaAsset> {
    return this.http.post<MediaAsset>(BASE, body);
  }

  updateAlt(id: string, alt: string): Observable<MediaAsset> {
    return this.http.patch<MediaAsset>(`${BASE}/${id}`, { alt });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
