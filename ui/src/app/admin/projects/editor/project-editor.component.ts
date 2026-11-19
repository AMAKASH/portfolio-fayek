import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, firstValueFrom, map, startWith, switchMap, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { apiErrorCode, apiErrorMessage } from '../../../core/api/api-error';
import { AdminProject, ProjectStatus } from '../../../core/models/project';
import { ProjectViewComponent } from '../../../shared/project-view/project-view.component';
import { AdminProjectsApi } from '../../services/admin-projects.api';
import { ToastService } from '../../services/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { HasUnsavedChanges } from '../../shared/unsaved-changes.guard';
import { MediaFieldComponent } from './media-field.component';
import { PreviewFrameComponent } from './preview-frame.component';
import {
  BlockForm,
  BlockPreset,
  cloneBlock,
  createProjectForm,
  involvementControl,
  patchProjectForm,
  presetBlock,
  setBlockLayout,
  slugify,
  toInput,
  toPreview,
} from './project-form';

type Tab = 'details' | 'hero' | 'content' | 'landing' | 'seo';

@Component({
  selector: 'app-project-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    IconComponent,
    MediaFieldComponent,
    PreviewFrameComponent,
    ProjectViewComponent,
  ],
  templateUrl: './project-editor.component.html',
  styleUrl: './project-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectEditorComponent implements OnInit, HasUnsavedChanges {
  private api = inject(AdminProjectsApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  /** Public page-title suffix, shown in the SEO preview. */
  readonly siteTitle = environment.siteTitle;
  readonly form = createProjectForm();
  readonly blocks = this.form.controls.blocks;
  readonly involvement = this.form.controls.involvement;

  readonly id = signal<string | null>(null);
  readonly project = signal<AdminProject | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly conflict = signal(false);
  readonly tab = signal<Tab>('details');
  readonly showPreview = signal(true);
  readonly device = signal<'desktop' | 'mobile'>('desktop');
  readonly insertAt = signal<number | null>(null);
  readonly collapsed = signal<ReadonlySet<BlockForm>>(new Set());
  readonly slugTaken = signal(false);
  private slugEdited = false;

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'hero', label: 'Hero' },
    { id: 'content', label: 'Content' },
    { id: 'landing', label: 'Listing & landing' },
    { id: 'seo', label: 'SEO' },
  ];

  readonly presets: { id: BlockPreset; label: string; icon: string }[] = [
    { id: 'image', label: 'Image', icon: 'image' },
    { id: 'video', label: 'Video', icon: 'video' },
    { id: 'two-images', label: 'Two images', icon: 'split' },
    { id: 'two-videos', label: 'Two videos', icon: 'split' },
    { id: 'image-video', label: 'Image + video', icon: 'split' },
    { id: 'text', label: 'Text', icon: 'text' },
  ];

  /** Debounced form value → live preview. */
  private readonly value = toSignal(
    this.form.valueChanges.pipe(
      debounceTime(150),
      map(() => this.form.getRawValue()),
      startWith(this.form.getRawValue()),
    ),
    { requireSync: true },
  );
  readonly preview = computed(() => toPreview(this.value()));
  readonly status = computed(() => this.value().status);
  readonly blockErrors = computed(() => {
    this.value();
    return this.blocks.controls.filter((b) => b.invalid).length;
  });

  ngOnInit() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        const id = p.get('id');
        this.id.set(id);
        if (id) void this.load(id);
        else this.resetNew();
      });

    // Auto-slug from the title until the slug is edited by hand (new projects only).
    this.form.controls.title.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((t) => {
      if (!this.id() && !this.slugEdited) this.form.controls.slug.setValue(slugify(t), { emitEvent: true });
    });

    this.form.controls.slug.valueChanges
      .pipe(
        debounceTime(350),
        map((s) => s.trim()),
        distinctUntilChanged(),
        filter((s) => !!s && this.form.controls.slug.valid),
        switchMap((s) =>
          s === this.project()?.slug
            ? of(true)
            : this.api.slugAvailable(s, this.id() ?? undefined).pipe(catchError(() => of(true))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((available) => this.slugTaken.set(!available));
  }

  /* ---------------- loading / saving ---------------- */

  private resetNew() {
    this.project.set(null);
    this.form.reset();
    this.involvement.clear();
    this.blocks.clear();
    this.slugEdited = false;
    this.tab.set('details');
    this.form.markAsPristine();
  }

  async load(id: string) {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const p = await firstValueFrom(this.api.get(id));
      this.applyServer(p);
    } catch (e) {
      this.loadError.set(apiErrorMessage(e, 'Could not load project'));
    } finally {
      this.loading.set(false);
    }
  }

  private applyServer(p: AdminProject) {
    this.project.set(p);
    this.slugEdited = true;
    this.conflict.set(false);
    patchProjectForm(this.form, p);
    this.collapsed.set(new Set());
    // Emit once so the preview reflects the loaded data.
    this.form.updateValueAndValidity();
  }

  onSlugInput() {
    this.slugEdited = true;
  }

  async save(status?: ProjectStatus, overwrite = false) {
    if (this.saving()) return;
    if (status) this.form.controls.status.setValue(status);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.tab.set(this.firstInvalidTab());
      this.toast.error('Some fields need attention before saving.');
      return;
    }
    if (this.slugTaken()) {
      this.tab.set('details');
      this.toast.error('That slug is already used by another project.');
      return;
    }
    this.saving.set(true);
    try {
      const input = toInput(this.form);
      const id = this.id();
      if (!id) {
        const created = await firstValueFrom(this.api.create(input));
        this.form.markAsPristine();
        this.toast.success(created.status === 'published' ? 'Project published' : 'Draft saved');
        await this.router.navigate(['/admin/projects', created.id], { replaceUrl: true });
        return;
      }
      let version = this.project()!.version;
      if (overwrite) version = (await firstValueFrom(this.api.get(id))).version;
      const updated = await firstValueFrom(this.api.update(id, { ...input, version }));
      this.applyServer(updated);
      this.toast.success(updated.status === 'published' ? 'Saved & live' : 'Draft saved');
    } catch (e) {
      if (apiErrorCode(e) === 'VERSION_CONFLICT') {
        this.conflict.set(true);
      } else if (apiErrorCode(e) === 'SLUG_TAKEN') {
        this.slugTaken.set(true);
        this.tab.set('details');
        this.toast.error('That slug is already in use.');
      } else {
        this.toast.error(apiErrorMessage(e, 'Save failed'));
      }
    } finally {
      this.saving.set(false);
    }
  }

  async reloadLatest() {
    const id = this.id();
    if (id) await this.load(id);
  }

  private firstInvalidTab(): Tab {
    const c = this.form.controls;
    if (c.title.invalid || c.slug.invalid || c.mainTitle.invalid || c.subtitle.invalid || c.client.invalid || c.result.invalid || c.involvement.invalid || c.description.invalid) return 'details';
    if (c.hero.invalid) return 'hero';
    if (c.blocks.invalid) return 'content';
    if (c.featuredLabel.invalid) return 'landing';
    return 'seo';
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) e.preventDefault();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void this.save();
    }
  }

  /* ---------------- involvement ---------------- */

  addInvolvement(input?: HTMLInputElement) {
    const v = input?.value.trim() ?? '';
    if (input && !v) return;
    this.involvement.push(involvementControl(v));
    this.involvement.markAsDirty();
    if (input) input.value = '';
  }

  removeInvolvement(i: number) {
    this.involvement.removeAt(i);
    this.involvement.markAsDirty();
  }

  dropInvolvement(e: CdkDragDrop<unknown>) {
    this.moveControl(this.involvement, e.previousIndex, e.currentIndex);
  }

  /* ---------------- blocks ---------------- */

  addBlock(preset: BlockPreset, at?: number) {
    const block = presetBlock(preset);
    const index = at ?? this.blocks.length;
    this.blocks.insert(index, block);
    this.blocks.markAsDirty();
    this.insertAt.set(null);
  }

  removeBlock(i: number) {
    const b = this.blocks.at(i);
    const hasContent = b.controls.type.value === 'text' ? !!b.controls.body.value : b.controls.items.controls.some((x) => !!x.controls.url.value);
    if (hasContent && !confirm('Remove this block?')) return;
    this.blocks.removeAt(i);
    this.blocks.markAsDirty();
  }

  duplicateBlock(i: number) {
    this.blocks.insert(i + 1, cloneBlock(this.blocks.at(i)));
    this.blocks.markAsDirty();
  }

  moveBlock(i: number, delta: -1 | 1) {
    const to = i + delta;
    if (to < 0 || to >= this.blocks.length) return;
    this.moveControl(this.blocks, i, to);
  }

  dropBlock(e: CdkDragDrop<unknown>) {
    this.moveControl(this.blocks, e.previousIndex, e.currentIndex);
  }

  setLayout(b: BlockForm, layout: 'full' | 'split') {
    setBlockLayout(b, layout);
  }

  toggleCollapse(b: BlockForm) {
    const next = new Set(this.collapsed());
    if (next.has(b)) next.delete(b);
    else next.add(b);
    this.collapsed.set(next);
  }

  collapseAll(collapse: boolean) {
    this.collapsed.set(collapse ? new Set(this.blocks.controls) : new Set());
  }

  blockSummary(b: BlockForm): string {
    const v = b.getRawValue();
    if (v.type === 'text') return v.heading || v.body.slice(0, 60) || 'Empty text';
    const kinds = v.items.map((i) => i.kind);
    if (kinds.length === 2) return kinds[0] === kinds[1] ? `Two ${kinds[0]}s` : 'Image + video';
    return kinds[0] === 'video' ? 'Full-width video' : 'Full-width image';
  }

  private moveControl(arr: FormArray, from: number, to: number) {
    if (from === to) return;
    const ctrl = arr.at(from);
    arr.removeAt(from, { emitEvent: false });
    arr.insert(to, ctrl);
    arr.markAsDirty();
  }
}
