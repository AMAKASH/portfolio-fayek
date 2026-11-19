import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/api/api-error';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="wrap">
      <form class="card login" [formGroup]="form" (ngSubmit)="submit()">
        <div class="brand"><span class="mark">F</span><h1>Sign in</h1></div>
        @if (expired) {
          <div class="banner banner--warn">Your session expired. Please sign in again.</div>
        }
        @if (error()) {
          <div class="banner banner--error" role="alert">{{ error() }}</div>
        }
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="username" autofocus />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        <button class="btn btn--primary btn--block" type="submit" [disabled]="busy() || form.invalid">
          @if (busy()) { <span class="adm-spinner" style="width:14px;height:14px"></span> } Sign in
        </button>
      </form>
    </div>
  `,
  styles: [
    `
      .wrap {
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .login {
        width: min(380px, 100%);
        display: grid;
        gap: 16px;
        padding: 28px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .mark {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: var(--a-accent);
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 700;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly expired = this.route.snapshot.queryParamMap.has('expired');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit() {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(redirect?.startsWith('/admin') && !redirect.startsWith('/admin/login') ? redirect : '/admin/projects');
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'Sign in failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
