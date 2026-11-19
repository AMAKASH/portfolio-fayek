import { Directive, ElementRef, NgZone, OnDestroy, afterNextRender, inject } from '@angular/core';

/**
 * Plays a muted, looping <video> only while it's on screen and pauses it otherwise.
 * Replaces the `autoplay` attribute on below-the-fold videos so a long case study
 * doesn't download and decode every video at once.
 */
@Directive({
  selector: 'video[appAutoplayInView]',
  standalone: true,
  host: { muted: '', loop: '', playsinline: '', preload: 'metadata' },
})
export class AutoplayInViewDirective implements OnDestroy {
  private el = inject<ElementRef<HTMLVideoElement>>(ElementRef);
  private observer?: IntersectionObserver;

  constructor() {
    const zone = inject(NgZone);
    afterNextRender(() => {
      const video = this.el.nativeElement;
      video.muted = true; // required for autoplay policies; the attribute alone isn't reflected after hydration
      if (typeof IntersectionObserver === 'undefined') {
        void video.play().catch(() => undefined);
        return;
      }
      zone.runOutsideAngular(() => {
        this.observer = new IntersectionObserver(
          ([entry]) => {
            if (entry?.isIntersecting) {
              if (video.preload !== 'auto') video.preload = 'auto';
              void video.play().catch(() => undefined);
            } else {
              video.pause();
            }
          },
          { rootMargin: '200px 0px', threshold: 0.01 },
        );
        this.observer.observe(video);
      });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
