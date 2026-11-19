import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { MediaAsset, MediaKind } from '../../core/models/project';
import { MediaApi } from '../services/media.api';
import { IconComponent } from '../shared/icon.component';

/** Modal grid of uploaded assets. Emits the chosen asset. */
@Component({
  selector: 'app-media-picker',
  standalone: true,
  imports: [FormsModule, IconComponent, DecimalPipe],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="Media library" (click)="$event.stopPropagation()">
        <div class="dialog__head">
          <h2>Choose from library</h2>
          <select class="select" style="width:140px" [ngModel]="kind()" (ngModelChange)="kind.set($event); reload()" [disabled]="!!lockKind">
            <option value="">All media</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
          <input class="input" style="width:200px" type="search" placeholder="Search…" [ngModel]="search()" (ngModelChange)="search.set($event); reload()" />
          <button class="btn btn--ghost btn--icon" type="button" (click)="closed.emit()" aria-label="Close"><app-icon name="x" /></button>
        </div>
        <div class="dialog__body">
          @if (error()) {
            <div class="banner banner--error">{{ error() }}</div>
          } @else if (!items().length && !loading()) {
            <div class="empty">No media yet. Upload files from any media field or the Media library page.</div>
          }
          <div class="pgrid">
            @for (m of items(); track m.id) {
              <button type="button" class="pcell" (click)="picked.emit(m)" [title]="m.originalName">
                @if (m.kind === 'image') {
                  <img [src]="m.url" alt="" loading="lazy" />
                } @else {
                  <video [src]="m.url + '#t=0.5'" muted preload="metadata"></video>
                  <span class="badge"><app-icon name="video" [size]="12" /></span>
                }
                <span class="name small truncate">{{ m.originalName || m.key }}</span>
                <span class="meta small muted">{{ m.size / 1048576 | number: '1.0-1' }} MB @if (m.width) { · {{ m.width }}×{{ m.height }} }</span>
              </button>
            }
          </div>
          @if (loading()) {
            <div class="empty"><span class="adm-spinner"></span></div>
          } @else if (items().length < total()) {
            <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" type="button" (click)="more()">Load more</button></div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .pgrid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
      }
      .pcell {
        position: relative;
        display: grid;
        gap: 4px;
        text-align: left;
        padding: 6px;
        border-radius: 9px;
        border: 1px solid var(--a-border);
        background: var(--a-surface);
        cursor: pointer;
        font: inherit;
        color: inherit;
        min-width: 0;
        &:hover {
          border-color: var(--a-accent);
        }
        img,
        video {
          width: 100%;
          aspect-ratio: 4/3;
          object-fit: cover;
          border-radius: 6px;
          background: var(--a-subtle);
        }
      }
      .badge {
        position: absolute;
        top: 12px;
        left: 12px;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border-radius: 5px;
        padding: 3px;
        display: inline-flex;
      }
      .name {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaPickerComponent implements OnInit {
  @Input() lockKind: MediaKind | null = null;
  @Output() picked = new EventEmitter<MediaAsset>();
  @Output() closed = new EventEmitter<void>();

  private api = inject(MediaApi);
  readonly items = signal<MediaAsset[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly kind = signal<MediaKind | ''>('');
  readonly search = signal('');
  private page = 1;
  private reloadTimer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    if (this.lockKind) this.kind.set(this.lockKind);
    void this.fetch(true);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.closed.emit();
  }

  reload() {
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => void this.fetch(true), 250);
  }

  more() {
    this.page++;
    void this.fetch(false);
  }

  private async fetch(reset: boolean) {
    if (reset) this.page = 1;
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await firstValueFrom(
        this.api.list({ kind: this.kind(), search: this.search(), page: this.page, limit: 48 }),
      );
      this.items.set(reset ? res.items : [...this.items(), ...res.items]);
      this.total.set(res.total);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'Could not load media'));
    } finally {
      this.loading.set(false);
    }
  }
}
