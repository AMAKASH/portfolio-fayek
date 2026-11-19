import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AdminProjectListItem } from '../../core/models/project';
import { AdminProjectsApi } from '../services/admin-projects.api';
import { ToastService } from '../services/toast.service';
import { IconComponent } from '../shared/icon.component';

/** Order and membership of the landing-page tiles. */
@Component({
  selector: 'app-admin-featured',
  standalone: true,
  imports: [RouterLink, CdkDropList, CdkDrag, CdkDragHandle, IconComponent],
  template: `
    <div class="page">
      <div class="page__head">
        <h1>Landing tiles</h1>
        <a class="btn" href="/" target="_blank" rel="noopener"><app-icon name="external" /> View landing page</a>
      </div>
      <p class="muted intro">These project tiles appear on the home page in this order. Drag to reorder. Only <strong>published</strong> projects are shown on the site.</p>

      @if (loading()) {
        <div class="empty"><span class="adm-spinner"></span></div>
      } @else {
        <div class="card list" cdkDropList (cdkDropListDropped)="drop($event)">
          @for (p of featured(); track p.id; let i = $index; let first = $first; let last = $last) {
            <div class="tile" cdkDrag>
              <span class="drag-handle" cdkDragHandle><app-icon name="grip" /></span>
              <span class="badge">{{ i + 1 }}</span>
              @if (p.featuredImage) { <img class="img" [src]="p.featuredImage" alt="" /> } @else { <span class="img"></span> }
              <div class="text">
                <strong class="truncate">{{ p.featuredLabel || p.title }}</strong>
                <span class="small muted row">
                  @if (p.status !== 'published') { <span class="pill pill--draft">Draft: hidden</span> }
                  @if (!p.blockCount) { <span>No case study: tile isn't clickable</span> }
                  @if (!p.listed) { <span>Not in works grid</span> }
                </span>
              </div>
              <div class="actions">
                <button class="btn btn--ghost btn--icon" type="button" (click)="move(i, -1)" [disabled]="first" aria-label="Move up"><app-icon name="up" /></button>
                <button class="btn btn--ghost btn--icon" type="button" (click)="move(i, 1)" [disabled]="last" aria-label="Move down"><app-icon name="down" /></button>
                <a class="btn btn--ghost btn--icon" [routerLink]="['/admin/projects', p.id]" title="Edit tile & project"><app-icon name="edit" /></a>
                <button class="btn btn--sm" type="button" (click)="setFeatured(p, false)" [disabled]="busy()">Remove</button>
              </div>
            </div>
          } @empty {
            <div class="empty">No tiles yet. Add projects below.</div>
          }
        </div>

        @if (others().length) {
          <h2 class="sub">Add a tile</h2>
          <div class="others">
            @for (p of others(); track p.id) {
              <button type="button" class="other card" (click)="setFeatured(p, true)" [disabled]="busy()">
                @if (p.thumbnail) { <img [src]="p.thumbnail" alt="" loading="lazy" /> } @else { <span class="ph"></span> }
                <span class="truncate"><app-icon name="plus" [size]="14" /> {{ p.title }}</span>
                @if (p.status !== 'published') { <span class="pill pill--draft">Draft</span> }
              </button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .intro { margin: -8px 0 16px; }
      .list { padding: 4px; }
      .tile {
        display: grid;
        grid-template-columns: auto 24px 150px minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 8px;
        background: var(--a-surface);
        border-radius: 8px;
        & + .tile { border-top: 1px solid var(--a-border); }
      }
      .badge { font-size: 12px; font-weight: 600; color: var(--a-muted); text-align: center; }
      .img { width: 150px; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; background: var(--a-subtle); }
      .text { display: grid; min-width: 0; gap: 3px; }
      .actions { display: flex; gap: 2px; align-items: center; }
      .sub { margin: 26px 0 10px; }
      .others { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
      .other {
        display: grid; gap: 6px; padding: 8px; text-align: left; cursor: pointer; font: inherit; color: inherit;
        img, .ph { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: 6px; background: var(--a-subtle); }
        &:hover { border-color: var(--a-accent); }
        .pill { width: max-content; }
      }
      @media (max-width: 700px) {
        .tile { grid-template-columns: 24px 90px minmax(0, 1fr); }
        .drag-handle { display: none; }
        .img { width: 90px; }
        .actions { grid-column: 1 / -1; justify-content: flex-end; }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedComponent {
  private api = inject(AdminProjectsApi);
  private toast = inject(ToastService);

  readonly all = signal<AdminProjectListItem[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly featured = computed(() =>
    this.all()
      .filter((p) => p.featured)
      .sort((a, b) => a.featuredOrder - b.featuredOrder),
  );
  readonly others = computed(() => this.all().filter((p) => !p.featured));

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      this.all.set((await firstValueFrom(this.api.list({ limit: 500 }))).items);
    } catch (e) {
      this.toast.error(apiErrorMessage(e, 'Could not load projects'));
    } finally {
      this.loading.set(false);
    }
  }

  async drop(e: CdkDragDrop<unknown>) {
    if (e.previousIndex === e.currentIndex) return;
    const list = [...this.featured()];
    moveItemInArray(list, e.previousIndex, e.currentIndex);
    await this.saveOrder(list);
  }

  async move(i: number, delta: -1 | 1) {
    const list = [...this.featured()];
    moveItemInArray(list, i, i + delta);
    await this.saveOrder(list);
  }

  private async saveOrder(list: AdminProjectListItem[]) {
    const before = this.all();
    const order = new Map(list.map((p, i) => [p.id, i]));
    this.all.set(before.map((p) => (order.has(p.id) ? { ...p, featuredOrder: order.get(p.id)! } : p)));
    try {
      await firstValueFrom(this.api.reorderFeatured(list.map((p) => p.id)));
      this.toast.success('Tile order saved');
    } catch (err) {
      this.all.set(before);
      this.toast.error(apiErrorMessage(err, 'Could not save order'));
    }
  }

  async setFeatured(p: AdminProjectListItem, featured: boolean) {
    this.busy.set(true);
    try {
      const u = await firstValueFrom(this.api.patch(p.id, { featured }));
      this.all.update((list) => list.map((x) => (x.id === p.id ? { ...x, featured: u.featured, featuredOrder: u.featuredOrder } : x)));
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
