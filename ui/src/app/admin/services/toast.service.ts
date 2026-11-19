import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  success(text: string) {
    this.push('success', text);
  }
  error(text: string) {
    this.push('error', text, 7000);
  }
  info(text: string) {
    this.push('info', text);
  }

  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  private push(kind: Toast['kind'], text: string, ms = 3500) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t.slice(-4), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
