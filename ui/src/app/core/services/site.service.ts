import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api.config';
import { HomeHero, SiteSettings } from '../models/project';

/** Used if the API is unreachable, so the home page never renders without a hero. */
export const FALLBACK_HOME_HERO: HomeHero = {
  image:
    'https://ik.imagekit.io/uhvinpqxo/New%20Warc%20Website/assets/images/LandingPage/heroImage.png?updatedAt=1725444739430',
  mobileImage: '',
  video: '',
  poster: '',
  alt: '',
  buttonTopDesktop: 72,
  buttonTopMobile: 67,
};

/** Public site settings (home hero, ...). */
@Injectable({ providedIn: 'root' })
export class SiteService {
  private http = inject(HttpClient);

  settings(): Observable<SiteSettings> {
    return this.http.get<SiteSettings>(`${API_BASE}/settings`);
  }

  /** Admin */
  adminSettings(): Observable<SiteSettings> {
    return this.http.get<SiteSettings>(`${API_BASE}/admin/settings`);
  }

  updateSettings(body: { homeHero: HomeHero }): Observable<SiteSettings> {
    return this.http.put<SiteSettings>(`${API_BASE}/admin/settings`, body);
  }
}
