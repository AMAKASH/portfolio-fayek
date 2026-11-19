import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ObserverService } from '../../services/observer.service';
import { ContactLink } from '../models/project';
import { CONTACT_PLATFORMS, SiteService, linkHref, linkLabel, opensInPlace, tickerDuration } from '../services/site.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule ,RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HeaderComponent {
@ViewChild('swiper') myswiper:ElementRef|undefined

footerShow =false;

constructor(private observerService:ObserverService, private router: Router){

}

ngAfterViewInit(){
  if(this.myswiper && typeof(document)!=='undefined'){
    this.myswiper.nativeElement.initialize();
  }

  this.observerService.footerObserver.subscribe((value)=>{
    this.footerShow= value as boolean;
  });
}

isHovered = -1;
/** Logo, contact texts and links: admin → Site settings. null until loaded (SSR waits for it). */
readonly settings = toSignal(inject(SiteService).settings$, { initialValue: null });
readonly platforms = CONTACT_PLATFORMS;
// Kept out of the template: `??` inside an @for expression trips the Angular 17 compiler.
readonly links = computed(() => this.settings()?.contact?.links ?? []);
/** Scrolling texts beside the logo (admin → Site settings → Header ticker). */
readonly tickerItems = computed(() => (this.settings()?.ticker?.items ?? []).map((text, id) => ({ id, text })));
readonly tickerSeconds = computed(() => tickerDuration(this.tickerItems().map((i) => i.text)));

href(link: ContactLink): string {
  return linkHref(link.type, link.url);
}
label(link: ContactLink): string {
  return linkLabel(link);
}
inPlace(link: ContactLink): boolean {
  return opensInPlace(this.href(link));
}

// "About" is hidden for now (route removed in app.routes.ts; TeamPageComponent kept for later).
items = ['Home', 'Work', 'Contact'];
paths = ['/', '/works', ''];
activeIndex: number | null = null;

setActive(index: number): void {
  this.activeIndex = index;
}

/** "Contact" expands the header's contact panel (on the home page, after navigating there if needed). */
openContact(event: Event): void {
  event.preventDefault();
  if (this.router.url.split(/[?#]/)[0] === '/') {
    this.observerService.footerObserver.next(true);
  } else {
    this.router.navigateByUrl('/').then(() => setTimeout(() => this.observerService.footerObserver.next(true)));
  }
}
}
