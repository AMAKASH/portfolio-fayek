import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="shell" [class.shell--open]="navOpen()">
      <header class="topbar">
        <button class="btn btn--ghost btn--icon" type="button" (click)="navOpen.set(!navOpen())" aria-label="Toggle navigation">
          <app-icon name="menu" [size]="20" />
        </button>
        <strong>Fayek Al Rafi</strong>
      </header>

      <aside class="sidebar">
        <div class="brand">
          <img class="brand__mark" [src]="avatar" alt="" width="32" height="32" />
          <span>Fayek Al Rafi</span>
        </div>
        <nav>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="is-active" class="nav-link">
              <app-icon [name]="item.icon" />
              {{ item.label }}
            </a>
          }
        </nav>
        <div class="sidebar__foot">
          <a href="/" target="_blank" rel="noopener" class="nav-link"><app-icon name="external" /> View site</a>
          <div class="who small muted truncate" [title]="auth.user()?.email ?? ''">{{ auth.user()?.email }}</div>
          <button type="button" class="nav-link nav-link--btn" (click)="auth.logout()"><app-icon name="logout" /> Sign out</button>
        </div>
      </aside>
      <div class="scrim" (click)="navOpen.set(false)"></div>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .shell {
        display: grid;
        grid-template-columns: 232px minmax(0, 1fr);
        min-height: 100dvh;
      }
      .topbar {
        display: none;
      }
      .sidebar {
        position: sticky;
        top: 0;
        height: 100dvh;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 18px 12px;
        background: var(--a-surface);
        border-right: 1px solid var(--a-border);
        overflow-y: auto;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        padding: 0 8px;
      }
      .brand__mark {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--a-subtle);
        flex-shrink: 0;
      }
      nav {
        display: grid;
        gap: 2px;
      }
      .nav-link {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 36px;
        padding: 0 10px;
        border-radius: 7px;
        color: var(--a-text);
        text-decoration: none;
        font-weight: 500;
        &:hover {
          background: var(--a-subtle);
        }
        &.is-active {
          background: var(--a-accent);
          color: #fff;
        }
      }
      .nav-link--btn {
        border: 0;
        background: transparent;
        font: inherit;
        cursor: pointer;
        width: 100%;
        text-align: left;
      }
      .sidebar__foot {
        margin-top: auto;
        display: grid;
        gap: 2px;
        .who {
          padding: 6px 10px;
        }
      }
      .scrim {
        display: none;
      }
      .content {
        min-width: 0;
      }

      @media (max-width: 900px) {
        .shell {
          grid-template-columns: 1fr;
        }
        .topbar {
          display: flex;
          align-items: center;
          gap: 8px;
          position: sticky;
          top: 0;
          z-index: 50;
          height: 52px;
          padding: 0 10px;
          background: var(--a-surface);
          border-bottom: 1px solid var(--a-border);
        }
        .sidebar {
          position: fixed;
          z-index: 70;
          left: 0;
          top: 0;
          width: 260px;
          transform: translateX(-100%);
          transition: transform 0.2s ease;
        }
        .shell--open .sidebar {
          transform: none;
        }
        .shell--open .scrim {
          display: block;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          z-index: 60;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);
  readonly navOpen = signal(false);
  /** Sidebar brand photo (served from the S3 bucket through CloudFront). */
  readonly avatar = 'https://dkr8ufw2tu8er.cloudfront.net/fayek_head_shot.jpg';
  readonly nav = [
    { path: '/admin/projects', label: 'Projects', icon: 'folder' },
    { path: '/admin/home', label: 'Home page', icon: 'image' },
    { path: '/admin/featured', label: 'Landing tiles', icon: 'star' },
    { path: '/admin/media', label: 'Media library', icon: 'library' },
    { path: '/admin/site', label: 'Site settings', icon: 'link' },
    { path: '/admin/account', label: 'Account', icon: 'user' },
  ];

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.navOpen.set(false));
  }
}
