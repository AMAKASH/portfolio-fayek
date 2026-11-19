import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { SiteService } from './site.service';

/**
 * Applies site-wide branding from the settings API to the document head.
 * Runs on the server too, so SSR HTML already carries the configured favicon.
 * With no favicon configured the bundled icons from index.html stay in place.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private doc = inject(DOCUMENT);
  private site = inject(SiteService);
  private started = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    this.site.settings$.subscribe((s) => this.setFavicon(s.branding.favicon));
  }

  private setFavicon(url: string): void {
    if (!url) return;
    const links = this.doc.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]');
    links.forEach((link) => {
      link.setAttribute('href', url);
      // The bundled icons declare type/sizes; an uploaded PNG/SVG/JPEG may differ.
      link.removeAttribute('type');
      link.removeAttribute('sizes');
    });
  }
}
