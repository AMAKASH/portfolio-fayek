import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/api/api-error';
import { ToastService } from '../services/toast.service';

const match = (g: AbstractControl): ValidationErrors | null =>
  g.get('newPassword')?.value === g.get('confirm')?.value ? null : { mismatch: true };

@Component({
  selector: 'app-admin-account',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="page" style="max-width:640px">
      <div class="page__head"><h1>Account</h1></div>
      <div class="card stack">
        <div class="field"><span class="field__label">Signed in as</span><span>{{ auth.user()?.email }}</span></div>
      </div>
      <form class="card stack" style="margin-top:14px" [formGroup]="form" (ngSubmit)="submit()">
        <h2>Change password</h2>
        <p class="small muted">Changing your password signs out every other session.</p>
        <div class="field">
          <label for="cur">Current password</label>
          <input id="cur" class="input" type="password" formControlName="currentPassword" autocomplete="current-password" />
        </div>
        <div class="field">
          <label for="np">New password <span class="hint">at least 10 characters</span></label>
          <input id="np" class="input" type="password" formControlName="newPassword" autocomplete="new-password" />
        </div>
        <div class="field">
          <label for="cf">Confirm new password</label>
          <input id="cf" class="input" type="password" formControlName="confirm" autocomplete="new-password" />
          @if (form.errors?.['mismatch'] && form.controls.confirm.touched) { <span class="err">Passwords don't match.</span> }
        </div>
        @if (error()) { <div class="banner banner--error">{{ error() }}</div> }
        <div><button class="btn btn--primary" type="submit" [disabled]="form.invalid || busy()">Update password</button></div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  readonly auth = inject(AuthService);
  private toast = inject(ToastService);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup(
    {
      currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] }),
      confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: match },
  );

  async submit() {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { currentPassword, newPassword } = this.form.getRawValue();
      await this.auth.changePassword(currentPassword, newPassword);
      this.form.reset();
      this.toast.success('Password updated');
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'Could not update password'));
    } finally {
      this.busy.set(false);
    }
  }
}
