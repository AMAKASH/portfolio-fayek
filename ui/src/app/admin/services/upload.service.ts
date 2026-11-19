import { HttpBackend, HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, defer, filter, firstValueFrom, from, map, of, switchMap } from 'rxjs';
import { MediaAsset, MediaKind } from '../../core/models/project';
import { MediaApi, MediaConfig } from './media.api';

export type UploadEvent = { type: 'progress'; percent: number } | { type: 'done'; asset: MediaAsset };

const MB = 1024 * 1024;

/** Common types browsers report inconsistently (e.g. .mov as "" on some systems). */
function resolveMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif',
    gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  };
  return (ext && byExt[ext]) || '';
}

export function kindOfFile(file: File): MediaKind | null {
  const mime = resolveMime(file);
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

/** Reads intrinsic dimensions (and duration for videos) in the browser, so pages can reserve space (no CLS). */
function probe(file: File, kind: MediaKind): Promise<{ width?: number; height?: number; duration?: number }> {
  const url = URL.createObjectURL(file);
  const done = <T>(v: T) => {
    URL.revokeObjectURL(url);
    return v;
  };
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(done({})), 8000);
    if (kind === 'image') {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        resolve(done({ width: img.naturalWidth || undefined, height: img.naturalHeight || undefined }));
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(done({}));
      };
      img.src = url;
    } else {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve(
          done({
            width: v.videoWidth || undefined,
            height: v.videoHeight || undefined,
            duration: Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration * 10) / 10 : undefined,
          }),
        );
      };
      v.onerror = () => {
        clearTimeout(timeout);
        resolve(done({}));
      };
      v.src = url;
    }
  });
}

/**
 * Direct-to-S3 upload: presign (API) → multipart POST to S3 (progress) → confirm (API).
 * The file never passes through our servers.
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private api = inject(MediaApi);
  /** Raw client: S3 must not receive our auth header or go through app interceptors. */
  private raw = new HttpClient(inject(HttpBackend));

  async validate(file: File, expected?: MediaKind): Promise<string | null> {
    const kind = kindOfFile(file);
    if (!kind) return `"${file.name}" isn't an image or video.`;
    if (expected && kind !== expected) return `Expected ${expected === 'image' ? 'an image' : 'a video'}, got a ${kind}.`;
    let cfg: MediaConfig;
    try {
      cfg = await firstValueFrom(this.api.config());
    } catch {
      return null; // let the server decide
    }
    if (!cfg.enabled) return 'Uploads are disabled: S3 is not configured on the API.';
    const mime = resolveMime(file);
    if (!cfg.allowedTypes.includes(mime)) return `File type ${mime || 'unknown'} is not allowed.`;
    const max = kind === 'image' ? cfg.maxImageBytes : cfg.maxVideoBytes;
    if (file.size > max) return `"${file.name}" is ${(file.size / MB).toFixed(1)} MB; the ${kind} limit is ${Math.round(max / MB)} MB.`;
    return null;
  }

  upload(input: File, alt = ''): Observable<UploadEvent> {
    const mime = resolveMime(input);
    const file = mime && mime !== input.type ? new File([input], input.name, { type: mime }) : input;
    const kind = kindOfFile(file) ?? 'image';
    const meta = probe(file, kind);

    return this.api.presign(file).pipe(
      switchMap((p) => {
        const form = new FormData();
        for (const [k, v] of Object.entries(p.upload.fields)) form.append(k, v);
        form.append('file', file); // must be the last field for S3
        const send$ = this.raw.post(p.upload.url, form, { reportProgress: true, observe: 'events' }).pipe(
          filter((e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
          map((e): UploadEvent | null =>
            e.type === HttpEventType.UploadProgress
              ? { type: 'progress', percent: e.total ? Math.min(99, Math.round((100 * e.loaded) / e.total)) : 0 }
              : null,
          ),
          filter((e): e is UploadEvent => e !== null),
        );
        const confirm$ = defer(() => from(meta)).pipe(
          switchMap((m) => this.api.confirm({ key: p.key, originalName: file.name, alt, ...m })),
          map((asset): UploadEvent => ({ type: 'done', asset })),
        );
        return concat(of<UploadEvent>({ type: 'progress', percent: 0 }), send$, confirm$);
      }),
    );
  }
}
