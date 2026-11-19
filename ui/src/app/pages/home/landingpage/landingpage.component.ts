import { Component, DestroyRef, NgZone, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { FALLBACK_HOME_HERO, SiteService } from '../../../core/services/site.service';
import { HeaderComponent } from "../../../core/header/header.component";
import { ProjectService } from '../../../core/services/project.service';
import { ObserverService } from '../../../services/observer.service';

@Component({
  selector: 'app-landingpage',
  standalone: true,
  imports: [HeaderComponent, RouterLink],
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.scss'
})
export class LandingpageComponent {

  /** Hero image/video, edited in the admin (/admin/home). null until loaded (SSR waits for it). */
  readonly hero = toSignal(
    inject(SiteService).settings().pipe(
      map((s) => s.homeHero),
      catchError(() => of(FALLBACK_HOME_HERO)),
    ),
    { initialValue: null },
  );

  /** Featured tiles, ordered in the admin (/admin/featured). */
  readonly tiles = toSignal(inject(ProjectService).featured().pipe(catchError(() => of([]))), { initialValue: [] });

  private observerService = inject(ObserverService);
  private zone = inject(NgZone);
  private expanded = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Stay in sync when the panel is opened elsewhere (e.g. the header's "Contact" link).
    this.observerService.footerObserver
      .pipe(takeUntilDestroyed())
      .subscribe((v) => (this.expanded = !!v));
    // Browser only: expand the header's contact panel when the user keeps scrolling
    // down after reaching the end of the page; collapse it when they scroll back up.
    afterNextRender(() => {
      const off = this.zone.runOutsideAngular(() => this.listenForOverscroll());
      destroyRef.onDestroy(() => {
        off();
        this.set(false);
      });
    });
  }

  private set(value: boolean) {
    if (this.expanded === value) return;
    this.expanded = value;
    this.zone.run(() => this.observerService.footerObserver.next(value));
  }

  private atBottom(): boolean {
    const doc = document.documentElement;
    return window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
  }

  /** Returns a function that removes the listeners. */
  private listenForOverscroll(): () => void {
    const down = () => {
      if (this.atBottom()) this.set(true);
    };
    const up = () => this.set(false);

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) down();
      else if (e.deltaY < 0) up();
    };

    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0]?.clientY ?? null);
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      const delta = touchY - y; // > 0: finger moves up = scrolling down
      if (delta > 30) down();
      else if (delta < -30) up();
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (['ArrowDown', 'PageDown', 'End', ' '].includes(e.key)) down();
      else if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) up();
    };

    // Leaving the bottom (by any means, e.g. scrollbar drag) collapses the panel.
    const onScroll = () => {
      if (this.expanded && !this.atBottom()) this.set(false);
    };

    const passive = { passive: true } as const;
    window.addEventListener('wheel', onWheel, passive);
    window.addEventListener('touchstart', onTouchStart, passive);
    window.addEventListener('touchmove', onTouchMove, passive);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, passive);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }
}
