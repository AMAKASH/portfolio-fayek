import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { MediaAsset, MediaKind } from '../../../core/models/project';
import { MediaPickerComponent } from '../../media/media-picker.component';
import { UploadService, kindOfFile } from '../../services/upload.service';
import { IconComponent } from '../../shared/icon.component';
import { MediaItemForm } from './project-form';

/**
 * One media slot: drag a file onto it, upload (direct to S3 with progress), pick from the
 * library, or paste any URL. Two modes:
 *  - [item]: a full block media item (kind toggle, alt text, video poster)
 *  - [control] + [kind]: a single URL field (thumbnail, hero image, OG image...)
 */
@Component({
  selector: 'app-media-field',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent, MediaPickerComponent],
  templateUrl: './media-field.component.html',
  styleUrl: './media-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaFieldComponent implements OnInit {
  @Input() item?: MediaItemForm;
  @Input() control?: FormControl<string>;
  @Input() kind: MediaKind = 'image';
  @Input() label = '';
  @Input() hint = '';
  @Input() compact = false;

  @ViewChild('file') fileInput?: ElementRef<HTMLInputElement>;

  private uploads = inject(UploadService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  readonly progress = signal<number | null>(null);
  readonly error = signal('');
  readonly dragOver = signal(false);
  readonly picking = signal(false);
  private sub?: Subscription;

  get urlControl(): FormControl<string> {
    return (this.item?.controls.url ?? this.control)!;
  }
  get currentKind(): MediaKind {
    return this.item?.controls.kind.value ?? this.kind;
  }
  get accept(): string {
    if (this.item) return 'image/*,video/*';
    return this.kind === 'video' ? 'video/*' : 'image/*';
  }

  ngOnInit() {
    // Re-render preview when the value changes from outside (paste, patch, library pick).
    this.urlControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
    this.destroyRef.onDestroy(() => this.sub?.unsubscribe());
  }

  setKind(kind: MediaKind) {
    if (!this.item || this.item.controls.kind.value === kind) return;
    this.item.controls.kind.setValue(kind);
    this.item.markAsDirty();
  }

  browse() {
    this.fileInput?.nativeElement.click();
  }

  onFileInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.start(file);
  }

  onDragOver(ev: DragEvent) {
    if (!ev.dataTransfer?.types.includes('Files')) return;
    ev.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragOver.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file) void this.start(file);
  }

  cancel() {
    this.sub?.unsubscribe();
    this.progress.set(null);
  }

  clear() {
    this.urlControl.setValue('');
    if (this.item) this.item.patchValue({ mediaId: null, width: null, height: null });
    this.urlControl.markAsDirty();
  }

  onPicked(asset: MediaAsset) {
    this.picking.set(false);
    this.apply(asset);
  }

  private async start(file: File) {
    this.error.set('');
    const expected = this.item ? undefined : this.kind;
    const problem = await this.uploads.validate(file, expected);
    if (problem) {
      this.error.set(problem);
      return;
    }
    if (this.item) {
      const k = kindOfFile(file);
      if (k) this.setKind(k);
    }
    this.sub?.unsubscribe();
    this.progress.set(0);
    const alt = this.item?.controls.alt.value ?? '';
    this.sub = this.uploads.upload(file, alt).subscribe({
      next: (e) => {
        if (e.type === 'progress') this.progress.set(e.percent);
        else {
          this.progress.set(null);
          this.apply(e.asset);
        }
      },
      error: (err) => {
        this.progress.set(null);
        this.error.set(apiErrorMessage(err, 'Upload failed'));
      },
    });
  }

  private apply(asset: MediaAsset) {
    if (this.item) {
      this.item.patchValue({
        kind: asset.kind,
        url: asset.url,
        mediaId: asset.id,
        width: asset.width,
        height: asset.height,
        alt: this.item.controls.alt.value || asset.alt,
      });
      this.item.markAsDirty();
    } else {
      this.urlControl.setValue(asset.url);
      this.urlControl.markAsDirty();
    }
    this.cdr.markForCheck();
  }
}
