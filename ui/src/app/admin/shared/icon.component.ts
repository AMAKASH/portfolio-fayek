import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Tiny inline icon set (stroke icons, 24px grid) — avoids pulling an icon library into the admin chunk. */
const PATHS: Record<string, string> = {
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  x: 'M6 6l12 12M18 6L6 18',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  video: 'M4 6h12v12H4zM16 10l5-3v10l-5-3',
  text: 'M5 6h14M5 12h14M5 18h9',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  star: 'M12 3l2.7 5.6 6.3.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.3-.9z',
  folder: 'M3 6h6l2 2h10v11H3z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  desktop: 'M3 5h18v11H3zM8 20h8M12 16v4',
  mobile: 'M8 3h8v18H8zM11 18h2',
  library: 'M4 4h6v16H4zM14 4l6 2-4 14-6-2z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  check: 'M5 12l5 5L20 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  split: 'M4 5h7v14H4zM13 5h7v14h-7z',
  full: 'M4 5h16v14H4z',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="d" /></svg>`,
  styles: [':host{display:inline-flex;flex-shrink:0}'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  @Input({ required: true }) set name(v: string) {
    this.d = PATHS[v] ?? '';
  }
  @Input() size = 16;
  d = '';
}
