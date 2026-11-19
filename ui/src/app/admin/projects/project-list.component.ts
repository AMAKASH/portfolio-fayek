import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AdminProjectListItem, ProjectStatus } from '../../core/models/project';
import { AdminProjectsApi } from '../services/admin-projects.api';
import { ToastService } from '../services/toast.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-admin-project-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, CdkDropList, CdkDrag, CdkDragHandle, IconComponent],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent {
  private api = inject(AdminProjectsApi);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly all = signal<AdminProjectListItem[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly busyId = signal<string | null>(null);

  readonly search = signal('');
  readonly status = signal<ProjectStatus | ''>('');

  /** Filtering is client-side: the whole catalogue is small and this keeps reordering simple. */
  readonly items = computed(() => {
    const q = this.search().trim().toLowerCase();
    const s = this.status();
    return this.all().filter(
      (p) =>
        (!s || p.status === s) &&
        (!q || [p.title, p.slug, p.description].some((v) => v.toLowerCase().includes(q))),
    );
  });
  /** Reordering a filtered subset would be ambiguous, so it's only allowed on the full list. */
  readonly canReorder = computed(() => !this.search().trim() && !this.status());
  readonly counts = computed(() => {
    const a = this.all();
    return {
      total: a.length,
      published: a.filter((p) => p.status === 'published').length,
      inGrid: a.filter((p) => p.status === 'published' && p.listed).length,
      featured: a.filter((p) => p.status === 'published' && p.featured).length,
    };
  });

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const res = await firstValueFrom(this.api.list({ limit: 500 }));
      this.all.set(res.items);
    } catch (e) {
      this.loadError.set(apiErrorMessage(e, 'Could not load projects'));
    } finally {
      this.loading.set(false);
    }
  }

  async drop(e: CdkDragDrop<AdminProjectListItem[]>) {
    if (e.previousIndex === e.currentIndex) return;
    const before = this.all();
    const next = [...before];
    moveItemInArray(next, e.previousIndex, e.currentIndex);
    this.all.set(next); // optimistic
    try {
      await firstValueFrom(this.api.reorder(next.map((p) => p.id)));
      this.toast.success('Order saved');
    } catch (err) {
      this.all.set(before);
      this.toast.error(apiErrorMessage(err, 'Could not save order'));
    }
  }

  async move(p: AdminProjectListItem, delta: -1 | 1) {
    const from = this.all().indexOf(p);
    const to = from + delta;
    if (to < 0 || to >= this.all().length) return;
    await this.drop({ previousIndex: from, currentIndex: to } as CdkDragDrop<AdminProjectListItem[]>);
  }

  async toggle(p: AdminProjectListItem, field: 'status' | 'listed' | 'featured') {
    const body =
      field === 'status'
        ? { status: (p.status === 'published' ? 'draft' : 'published') as ProjectStatus }
        : { [field]: !p[field] };
    this.busyId.set(p.id);
    try {
      const updated = await firstValueFrom(this.api.patch(p.id, body));
      this.all.update((list) =>
        list.map((x) =>
          x.id === p.id
            ? { ...x, status: updated.status, listed: updated.listed, featured: updated.featured, featuredOrder: updated.featuredOrder, updatedAt: updated.updatedAt }
            : x,
        ),
      );
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    } finally {
      this.busyId.set(null);
    }
  }

  async duplicate(p: AdminProjectListItem) {
    this.busyId.set(p.id);
    try {
      const copy = await firstValueFrom(this.api.duplicate(p.id));
      this.toast.success(`Duplicated as "${copy.title}"`);
      await this.router.navigate(['/admin/projects', copy.id]);
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    } finally {
      this.busyId.set(null);
    }
  }

  async remove(p: AdminProjectListItem) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    this.busyId.set(p.id);
    try {
      await firstValueFrom(this.api.remove(p.id));
      this.all.update((list) => list.filter((x) => x.id !== p.id));
      this.toast.success('Project deleted');
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    } finally {
      this.busyId.set(null);
    }
  }
}
