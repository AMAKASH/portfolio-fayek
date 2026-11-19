import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api.config';

interface Session {
  accessToken: string;
  user: { id: string; email: string };
}

/**
 * Single-admin session.
 * - Access token lives in memory only (never localStorage) → XSS can't persist it.
 * - Refresh token is an httpOnly cookie scoped to /api/v1/auth, rotated on every refresh.
 * - Uses HttpBackend directly so auth calls bypass the interceptors (no refresh loops).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = new HttpClient(inject(HttpBackend));
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _token = signal<string | null>(null);
  readonly user = signal<Session['user'] | null>(null);
  readonly isLoggedIn = computed(() => !!this._token());

  private refreshing: Promise<boolean> | null = null;
  private restored = false;

  get token(): string | null {
    return this._token();
  }

  /** Restores the session from the refresh cookie once per page load. */
  async ensureSession(): Promise<boolean> {
    if (!this.isBrowser) return false;
    if (this._token()) return true;
    if (this.restored && !this.refreshing) return false;
    this.restored = true;
    return this.refresh();
  }

  /** De-duplicated: concurrent 401s trigger a single refresh request. */
  refresh(): Promise<boolean> {
    this.refreshing ??= firstValueFrom(
      this.http.post<Session>(`${API_BASE}/auth/refresh`, {}, { withCredentials: true }),
    )
      .then((s) => {
        this.setSession(s);
        return true;
      })
      .catch(() => {
        this.clear();
        return false;
      })
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  async login(email: string, password: string): Promise<void> {
    const s = await firstValueFrom(
      this.http.post<Session>(`${API_BASE}/auth/login`, { email, password }, { withCredentials: true }),
    );
    this.setSession(s);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true }));
    } finally {
      this.clear();
      await this.router.navigateByUrl('/admin/login');
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const s = await firstValueFrom(
      this.http.patch<Session>(
        `${API_BASE}/auth/password`,
        { currentPassword, newPassword },
        { withCredentials: true, headers: { Authorization: `Bearer ${this._token()}` } },
      ),
    );
    this.setSession(s);
  }

  /** Called by the interceptor when a refresh fails mid-session. */
  async expire(): Promise<void> {
    this.clear();
    await this.router.navigate(['/admin/login'], { queryParams: { expired: 1, redirect: this.router.url } });
  }

  private setSession(s: Session) {
    this._token.set(s.accessToken);
    this.user.set(s.user);
  }

  private clear() {
    this._token.set(null);
    this.user.set(null);
  }
}
