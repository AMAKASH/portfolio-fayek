import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { apiErrorCode, apiErrorMessage } from '../../core/api/api-error';
import { MediaAsset, MediaKind } from '../../core/models/project';
import { MediaApi } from '../services/media.api';
import { ToastService } from '../services/toast.service';
import { UploadService } from '../services/upload.service';
import { IconComponent } from '../shared/icon.component';

interface UploadJob {
  name: string;
  percent: number;
  error?: string;
}

@Component({
  selector: 'app-admin-media',
  standalone: true,
  imports: [FormsModule, IconComponent, DecimalPipe, DatePipe],
  template: `
    <div class="page" (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)" [class.is-drag]="dragging()">
      <div class="page__head">
        <h1>Media library</h1>
        <button class="btn btn--primary" type="button" (click)="file.click()"><app-icon name="upload" /> Upload files</button>
        <input #file type="file" multiple hidden accept="image/*,video/*" (change)="onFiles($event)" />
      </div>

      <div class="toolbar row">
        <select class="select" style="width:150px" [ngModel]="kind()" (ngModelChange)="kind.set($event); reload()">
          <option value="">All media</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
        <input class="input" style="max-width:280px" type="search" placeholder="Search by file name or alt…" [ngModel]="search()" (ngModelChange)="search.set($event); reload()" />
        <span class="spacer"></span>
        <span class="small muted">{{ total() }} file{{ total() === 1 ? '' : 's' }} · drop files anywhere to upload</span>
      </div>

      @if (jobs().length) {
        <div class="card jobs">
          @for (j of jobs(); track $index) {
            <div class="job">
              <span class="truncate small">{{ j.name }}</span>
              @if (j.error) { <span class="err small">{{ j.error }}</span> }
              @else { <div class="progress"><span [style.width.%]="j.percent"></span></div><span class="small muted">{{ j.percent }}%</span> }
            </div>
          }
        </div>
      }

      <div class="layout" [class.has-detail]="!!selected()">
        <div class="grid">
          @for (m of items(); track m.id) {
            <button type="button" class="cell" [class.is-on]="selected()?.id === m.id" (click)="select(m)">
              @if (m.kind === 'image') { <img [src]="m.url" [alt]="m.alt" loading="lazy" /> }
              @else { <video [src]="m.url + '#t=0.5'" muted preload="metadata"></video><span class="vbadge"><app-icon name="video" [size]="12" /></span> }
              <span class="small truncate">{{ m.originalName || m.key }}</span>
            </button>
          } @empty {
            @if (!loading()) { <div class="empty card" style="grid-column:1/-1">No media yet. Upload images and videos here or from any media field in the project editor.</div> }
          }
        </div>

        @if (selected(); as m) {
          <aside class="detail card">
            <div class="row"><strong class="truncate" style="flex:1">{{ m.originalName || 'File' }}</strong>
              <button class="btn btn--ghost btn--icon" type="button" (click)="selected.set(null)" aria-label="Close"><app-icon name="x" /></button></div>
            @if (m.kind === 'image') { <img class="big" [src]="m.url" [alt]="m.alt" /> }
            @else { <video class="big" [src]="m.url" controls muted playsinline preload="metadata"></video> }
            <dl>
              <dt>Type</dt><dd>{{ m.mime }}</dd>
              <dt>Size</dt><dd>{{ m.size / 1048576 | number: '1.0-2' }} MB</dd>
              @if (m.width) { <dt>Dimensions</dt><dd>{{ m.width }} × {{ m.height }}</dd> }
              @if (m.duration) { <dt>Duration</dt><dd>{{ m.duration }} s</dd> }
              <dt>Uploaded</dt><dd>{{ m.createdAt | date: 'medium' }}</dd>
            </dl>
            <div class="field">
              <label>URL</label>
              <div class="row"><input class="input mono" [value]="m.url" readonly (focus)="$any($event.target).select()" style="flex:1" />
                <button class="btn btn--icon" type="button" (click)="copy(m.url)" title="Copy URL"><app-icon name="copy" /></button></div>
            </div>
            <div class="field">
              <label>Alt text</label>
              <div class="row"><input class="input" [(ngModel)]="altDraft" style="flex:1" />
                <button class="btn btn--sm" type="button" (click)="saveAlt(m)" [disabled]="altDraft === m.alt">Save</button></div>
              <span class="hint">Used as the default alt text when you pick this file in the editor.</span>
            </div>
            <button class="btn btn--danger" type="button" (click)="remove(m)"><app-icon name="trash" /> Delete file</button>
          </aside>
        }
      </div>

      @if (loading()) { <div class="empty"><span class="adm-spinner"></span></div> }
      @else if (items().length < total()) {
        <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" type="button" (click)="more()">Load more</button></div>
      }
    </div>
  `,
  styles: [
    `
      .is-drag { outline: 2px dashed var(--a-accent); outline-offset: -8px; border-radius: 12px; }
      .toolbar { margin-bottom: 14px; }
      .jobs { display: grid; gap: 8px; margin-bottom: 14px; padding: 12px; }
      .job { display: grid; grid-template-columns: minmax(0, 220px) 1fr auto; gap: 10px; align-items: center; }
      .layout { display: grid; gap: 14px; align-items: start; }
      .layout.has-detail { grid-template-columns: minmax(0, 1fr) 340px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
      .cell {
        position: relative; display: grid; gap: 5px; padding: 6px; text-align: left; min-width: 0;
        border: 1px solid var(--a-border); border-radius: 9px; background: var(--a-surface); cursor: pointer; font: inherit; color: inherit;
        img, video { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 6px; background: var(--a-subtle); }
        &:hover, &.is-on { border-color: var(--a-accent); }
        &.is-on { box-shadow: var(--a-focus); }
      }
      .vbadge { position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,.6); color: #fff; border-radius: 5px; padding: 3px; display: inline-flex; }
      .detail { position: sticky; top: 16px; display: grid; gap: 12px; }
      .big { width: 100%; max-height: 260px; object-fit: contain; background: var(--a-subtle); border-radius: 8px; }
      dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 13px; }
      dt { color: var(--a-muted); }
      dd { margin: 0; word-break: break-all; }
      @media (max-width: 1000px) {
        .layout.has-detail { grid-template-columns: 1fr; }
        .detail { position: static; order: -1; }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaLibraryComponent {
  private api = inject(MediaApi);
  private uploads = inject(UploadService);
  private toast = inject(ToastService);

  readonly items = signal<MediaAsset[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly kind = signal<MediaKind | ''>('');
  readonly search = signal('');
  readonly selected = signal<MediaAsset | null>(null);
  readonly jobs = signal<UploadJob[]>([]);
  readonly dragging = signal(false);
  altDraft = '';
  private page = 1;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    void this.fetch(true);
  }

  reload() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.fetch(true), 250);
  }

  more() {
    this.page++;
    void this.fetch(false);
  }

  private async fetch(reset: boolean) {
    if (reset) this.page = 1;
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.list({ kind: this.kind(), search: this.search(), page: this.page, limit: 60 }));
      this.items.set(reset ? res.items : [...this.items(), ...res.items]);
      this.total.set(res.total);
    } catch (e) {
      this.toast.error(apiErrorMessage(e, 'Could not load media'));
    } finally {
      this.loading.set(false);
    }
  }

  select(m: MediaAsset) {
    this.selected.set(m);
    this.altDraft = m.alt;
  }

  onDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    this.dragging.set(true);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
    if (e.dataTransfer?.files?.length) void this.uploadAll(Array.from(e.dataTransfer.files));
  }

  onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.uploadAll(files);
  }

  /** Uploads up to 3 files at a time. */
  private async uploadAll(files: File[]) {
    const start = this.jobs().length;
    this.jobs.update((j) => [...j, ...files.map((f) => ({ name: f.name, percent: 0 }))]);
    const setJob = (i: number, patch: Partial<UploadJob>) =>
      this.jobs.update((j) => j.map((x, k) => (k === start + i ? { ...x, ...patch } : x)));

    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        const file = files[i]!;
        const problem = await this.uploads.validate(file);
        if (problem) {
          setJob(i, { error: problem });
          continue;
        }
        await new Promise<void>((resolve) => {
          this.uploads.upload(file).subscribe({
            next: (ev) => {
              if (ev.type === 'progress') setJob(i, { percent: ev.percent });
              else {
                setJob(i, { percent: 100 });
                this.items.update((list) => [ev.asset, ...list.filter((m) => m.id !== ev.asset.id)]);
                this.total.update((t) => t + 1);
              }
            },
            error: (err) => {
              setJob(i, { error: apiErrorMessage(err, 'Upload failed') });
              resolve();
            },
            complete: () => resolve(),
          });
        });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const failed = this.jobs().slice(start).filter((j) => j.error).length;
    if (failed) this.toast.error(`${failed} upload(s) failed`);
    else this.toast.success(`${files.length} file(s) uploaded`);
    setTimeout(() => this.jobs.update((j) => j.filter((x) => x.error)), 2500);
  }

  async saveAlt(m: MediaAsset) {
    try {
      const u = await firstValueFrom(this.api.updateAlt(m.id, this.altDraft));
      this.items.update((list) => list.map((x) => (x.id === u.id ? u : x)));
      this.selected.set(u);
      this.toast.success('Alt text saved');
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    }
  }

  async copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      this.toast.info('URL copied');
    } catch {
      this.toast.error('Copy failed');
    }
  }

  async remove(m: MediaAsset) {
    if (!confirm(`Delete "${m.originalName || m.key}" from storage? This cannot be undone.`)) return;
    try {
      await firstValueFrom(this.api.remove(m.id));
      this.items.update((list) => list.filter((x) => x.id !== m.id));
      this.total.update((t) => t - 1);
      this.selected.set(null);
      this.toast.success('File deleted');
    } catch (e) {
      this.toast.error(apiErrorCode(e) === 'MEDIA_IN_USE' ? apiErrorMessage(e) : apiErrorMessage(e, 'Delete failed'));
    }
  }
}
