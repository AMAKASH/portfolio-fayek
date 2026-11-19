import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, map, startWith } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { SiteService } from '../../core/services/site.service';
import { MediaFieldComponent } from '../projects/editor/media-field.component';
import { ToastService } from '../services/toast.service';
import { IconComponent } from '../shared/icon.component';
import { HasUnsavedChanges } from '../shared/unsaved-changes.guard';

const url = (v = '') => new FormControl(v, { nonNullable: true, validators: [Validators.maxLength(2048)] });

/** Home page settings: the landing hero (image, optional mobile crop, optional video). */
@Component({
  selector: 'app-admin-home-settings',
  standalone: true,
  imports: [ReactiveFormsModule, MediaFieldComponent, IconComponent],
  template: `
    <div class="page" style="max-width: 1100px">
      <div class="page__head">
        <h1>Home page</h1>
        <a class="btn" href="/" target="_blank" rel="noopener"><app-icon name="external" /> View home page</a>
        <button class="btn btn--primary" type="button" (click)="save()" [disabled]="saving() || loading() || form.pristine || form.invalid" title="Ctrl/⌘ + S">
          @if (saving()) { <span class="adm-spinner" style="width:14px;height:14px"></span> } Save
        </button>
      </div>

      @if (loading()) {
        <div class="empty"><span class="adm-spinner"></span></div>
      } @else {
        <div class="cols" [formGroup]="form">
          <section class="card stack">
            <h2>Hero</h2>
            <p class="small muted">The big banner at the top of the home page. Use a wide image (about 1900×910). Optionally add a portrait version for phones (about 1:1.8) and/or a video that plays instead of the image.</p>
            <app-media-field [control]="form.controls.image" kind="image" label="Hero image" hint="Required" />
            @if (form.controls.image.touched && form.controls.image.invalid) { <span class="err small">A hero image is required.</span> }
            <app-media-field [control]="form.controls.mobileImage" kind="image" label="Mobile image" hint="Optional, shown on screens ≤ 500px" />
            <app-media-field [control]="form.controls.video" kind="video" label="Hero video" hint="Optional, replaces the image when set" />
            @if (form.controls.video.value) {
              <app-media-field [control]="form.controls.poster" kind="image" label="Video poster" hint="Shown while the video loads; defaults to the hero image" />
            }
            <div class="field">
              <label for="alt">Alt text</label>
              <input id="alt" class="input" formControlName="alt" placeholder="Describe the image for screen readers" />
            </div>
          </section>

          <aside class="card stack preview">
            <div class="row"><strong class="small">Preview</strong></div>
            <span class="small muted">Desktop</span>
            <div class="frame frame--desktop">
              @if (value().video) {
                <video [src]="value().video" [attr.poster]="value().poster || value().image || null" muted autoplay loop playsinline></video>
              } @else if (value().image) {
                <img [src]="value().image" [alt]="value().alt" />
              }
              <span class="fake-btn">All Projects</span>
            </div>
            <span class="small muted">Mobile</span>
            <div class="frame frame--mobile">
              @if (value().video) {
                <video [src]="value().video" [attr.poster]="value().poster || value().image || null" muted autoplay loop playsinline></video>
              } @else if (value().mobileImage || value().image) {
                <img [src]="value().mobileImage || value().image" [alt]="value().alt" />
              }
              <span class="fake-btn">All Projects</span>
            </div>
          </aside>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 16px;
        align-items: start;
        @media (max-width: 1000px) {
          grid-template-columns: 1fr;
        }
      }
      .preview {
        position: sticky;
        top: 16px;
      }
      .frame {
        position: relative;
        overflow: hidden;
        border-radius: 10px;
        background: var(--a-subtle);
        img,
        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      }
      .frame--desktop {
        aspect-ratio: 1900 / 910;
      }
      .frame--mobile {
        width: 140px;
        aspect-ratio: 1 / 1.8;
      }
      .fake-btn {
        position: absolute;
        left: 50%;
        top: 15%;
        transform: translateX(-50%);
        font-size: 9px;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 999px;
        padding: 4px 12px;
        white-space: nowrap;
      }
      .frame--mobile .fake-btn {
        top: 23%;
        font-size: 7px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSettingsComponent implements HasUnsavedChanges {
  private site = inject(SiteService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly form = new FormGroup({
    image: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2048)] }),
    mobileImage: url(),
    video: url(),
    poster: url(),
    alt: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
  });
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
      const s = await firstValueFrom(this.site.adminSettings());
      this.form.reset(s.homeHero);
    } catch (e) {
      this.toast.error(apiErrorMessage(e, 'Could not load settings'));
    } finally {
      this.loading.set(false);
    }
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const s = await firstValueFrom(this.site.updateSettings({ homeHero: this.form.getRawValue() }));
      this.form.reset(s.homeHero);
      this.toast.success('Home page saved');
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
      if (!this.form.pristine) void this.save();
    }
  }
}
