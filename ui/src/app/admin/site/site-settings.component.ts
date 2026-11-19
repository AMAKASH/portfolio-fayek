import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, map, startWith } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ContactLink, ContactLinkType, SiteSettings } from '../../core/models/project';
import { CONTACT_PLATFORMS, SiteService, linkHref, linkLabel, tickerDuration } from '../../core/services/site.service';
import { MediaFieldComponent } from '../projects/editor/media-field.component';
import { ToastService } from '../services/toast.service';
import { IconComponent } from '../shared/icon.component';
import { HasUnsavedChanges } from '../shared/unsaved-changes.guard';

const text = (v = '', max = 200, required = false) =>
  new FormControl(v, { nonNullable: true, validators: [Validators.maxLength(max), ...(required ? [Validators.required] : [])] });

type LinkForm = FormGroup<{
  type: FormControl<ContactLinkType>;
  url: FormControl<string>;
  label: FormControl<string>;
  icon: FormControl<string>;
}>;

function linkForm(l: Partial<ContactLink> = {}): LinkForm {
  return new FormGroup({
    type: new FormControl<ContactLinkType>(l.type ?? 'email', { nonNullable: true }),
    url: text(l.url ?? '', 2048, true),
    label: text(l.label ?? '', 60),
    icon: text(l.icon ?? '', 2048),
  });
}

/** Branding (header logo, favicon), header contact panel, and the project-page call-to-action. */
@Component({
  selector: 'app-admin-site-settings',
  standalone: true,
  imports: [ReactiveFormsModule, MediaFieldComponent, IconComponent, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './site-settings.component.html',
  styleUrl: './site-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteSettingsComponent implements HasUnsavedChanges {
  private site = inject(SiteService);
  private toast = inject(ToastService);

  readonly platforms = CONTACT_PLATFORMS;
  readonly platformTypes = Object.keys(CONTACT_PLATFORMS) as ContactLinkType[];
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly form = new FormGroup({
    branding: new FormGroup({
      logo: text('', 2048, true),
      favicon: text('', 2048),
    }),
    ticker: new FormGroup({
      items: new FormArray<FormControl<string>>([]),
    }),
    contact: new FormGroup({
      heading: text('', 120),
      text: text('', 600),
      links: new FormArray<LinkForm>([]),
    }),
    projectCta: new FormGroup({
      heading: text('', 160),
      lines: new FormArray<FormControl<string>>([]),
      buttonLabel: text('', 40),
      buttonUrl: text('', 2048),
    }),
  });
  readonly links = this.form.controls.contact.controls.links;
  readonly lines = this.form.controls.projectCta.controls.lines;
  readonly tickerItems = this.form.controls.ticker.controls.items;

  readonly value = toSignal(
    this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      startWith(this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      this.apply(await firstValueFrom(this.site.adminSettings()));
    } catch (e) {
      this.toast.error(apiErrorMessage(e, 'Could not load settings'));
    } finally {
      this.loading.set(false);
    }
  }

  private apply(s: SiteSettings) {
    this.links.clear({ emitEvent: false });
    s.contact.links.forEach((l) => this.links.push(linkForm(l), { emitEvent: false }));
    this.tickerItems.clear({ emitEvent: false });
    s.ticker.items.forEach((t) => this.tickerItems.push(text(t, 60, true), { emitEvent: false }));
    this.lines.clear({ emitEvent: false });
    s.projectCta.lines.forEach((l) => this.lines.push(text(l, 160, true), { emitEvent: false }));
    this.form.reset({
      branding: s.branding,
      ticker: { items: s.ticker.items },
      contact: { heading: s.contact.heading, text: s.contact.text, links: s.contact.links },
      projectCta: { heading: s.projectCta.heading, lines: s.projectCta.lines, buttonLabel: s.projectCta.buttonLabel, buttonUrl: s.projectCta.buttonUrl },
    });
  }

  /* ---------- links ---------- */
  addLink(type: ContactLinkType) {
    this.links.push(linkForm({ type }));
    this.links.markAsDirty();
  }
  removeLink(i: number) {
    this.links.removeAt(i);
    this.links.markAsDirty();
  }
  moveLink(from: number, to: number) {
    if (to < 0 || to >= this.links.length || from === to) return;
    const c = this.links.at(from);
    this.links.removeAt(from, { emitEvent: false });
    this.links.insert(to, c);
    this.links.markAsDirty();
  }
  dropLink(e: CdkDragDrop<unknown>) {
    this.moveLink(e.previousIndex, e.currentIndex);
  }

  /* ---------- header ticker ---------- */
  addTickerItem(input?: HTMLInputElement) {
    const v = input?.value.trim() ?? '';
    if (input && !v) return;
    this.tickerItems.push(text(v, 60, true));
    this.tickerItems.markAsDirty();
    if (input) input.value = '';
  }
  removeTickerItem(i: number) {
    this.tickerItems.removeAt(i);
    this.tickerItems.markAsDirty();
  }
  dropTickerItem(e: CdkDragDrop<unknown>) {
    if (e.previousIndex === e.currentIndex) return;
    const c = this.tickerItems.at(e.previousIndex);
    this.tickerItems.removeAt(e.previousIndex, { emitEvent: false });
    this.tickerItems.insert(e.currentIndex, c);
    this.tickerItems.markAsDirty();
  }
  tickerSeconds(items: string[]) {
    return tickerDuration(items);
  }

  /* ---------- CTA lines ---------- */
  addLine() {
    this.lines.push(text('', 160, true));
    this.lines.markAsDirty();
  }
  removeLine(i: number) {
    this.lines.removeAt(i);
    this.lines.markAsDirty();
  }

  /* ---------- preview helpers ---------- */
  href(l: ContactLink) {
    return linkHref(l.type, l.url);
  }
  label(l: ContactLink) {
    return linkLabel(l);
  }
  ctaHref(url: string) {
    return linkHref('auto', url);
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Some fields need attention before saving.');
      return;
    }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const saved = await firstValueFrom(
        this.site.updateSettings({
          branding: v.branding,
          ticker: { items: v.ticker.items.map((t) => t.trim()).filter(Boolean) },
          contact: { ...v.contact, links: v.contact.links.map((l) => ({ ...l, icon: l.type === 'custom' ? l.icon : '' })) },
          projectCta: { ...v.projectCta, lines: v.projectCta.lines.map((l) => l.trim()).filter(Boolean) },
        }),
      );
      this.apply(saved);
      this.toast.success('Site settings saved');
    } catch (e) {
      this.toast.error(apiErrorMessage(e, 'Save failed'));
    } finally {
      this.saving.set(false);
    }
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
      if (this.form.dirty) void this.save();
    }
  }
}
