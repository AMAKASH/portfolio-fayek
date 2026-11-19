import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';

/**
 * Renders projected content at a real device width (1440 desktop / 390 mobile) and
 * scales it down to fit the pane. Because ProjectViewComponent uses container queries,
 * the content lays out exactly as it would on that device.
 */
@Component({
  selector: 'app-preview-frame',
  standalone: true,
  template: `
    <div class="outer" [style.height.px]="height()" [style.width.px]="width * scale()">
      <div #inner class="inner" [style.width.px]="width" [style.transform]="'scale(' + scale() + ')'">
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        overflow: hidden;
      }
      .outer {
        position: relative;
        overflow: hidden;
        margin: 0 auto;
        border-radius: 8px;
        box-shadow: 0 0 0 1px var(--a-border);
      }
      .inner {
        transform-origin: 0 0;
        position: absolute;
        top: 0;
        left: 0;
        background: #f3f3f3;
        padding: 0.5rem;
        box-sizing: border-box;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewFrameComponent implements AfterViewInit, OnDestroy {
  @Input() set device(d: 'desktop' | 'mobile') {
    this.width = d === 'mobile' ? 390 : 1440;
    queueMicrotask(() => this.measure());
  }
  width = 1440;

  @ViewChild('inner', { static: true }) inner!: ElementRef<HTMLElement>;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private ro?: ResizeObserver;

  readonly scale = signal(0.5);
  readonly height = signal(400);

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      this.ro = new ResizeObserver(() => this.zone.run(() => this.measure()));
      this.ro.observe(this.host.nativeElement);
      this.ro.observe(this.inner.nativeElement);
    });
    this.measure();
  }

  ngOnDestroy() {
    this.ro?.disconnect();
  }

  private measure() {
    const available = this.host.nativeElement.clientWidth;
    if (!available) return;
    const s = Math.min(1, available / this.width);
    this.scale.set(s);
    this.height.set(Math.ceil(this.inner.nativeElement.scrollHeight * s));
  }
}
