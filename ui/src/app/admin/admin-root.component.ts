import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, ViewEncapsulation, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './services/toast.service';

/**
 * Root of the lazy admin chunk. Holds the admin design system (unencapsulated,
 * all selectors scoped under `.adm`) so it only loads with the admin bundle.
 *
 * The admin is browser-only: the server renders a loader (the session lives in
 * browser memory) and hydration is skipped for this subtree.
 */
@Component({
  selector: 'app-admin-root',
  standalone: true,
  imports: [RouterOutlet],
  host: { ngSkipHydration: 'true', class: 'adm' },
  template: `
    @if (isBrowser) {
      <router-outlet />
    } @else {
      <div class="adm-boot"><span class="adm-spinner"></span></div>
    }
    <div class="adm-toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <button type="button" class="adm-toast" [class]="'adm-toast adm-toast--' + t.kind" (click)="toast.dismiss(t.id)">
          {{ t.text }}
        </button>
      }
    </div>
  `,
  styleUrl: './admin.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRootComponent {
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly toast = inject(ToastService);
}
