import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild } from '@angular/core';
import { ObserverService } from '../../services/observer.service';

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
