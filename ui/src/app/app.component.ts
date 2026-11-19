import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BrandingService } from './core/services/branding.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'portfolio-fayek';

  constructor() {
    // Dynamic favicon (admin → Site settings → Branding)
    inject(BrandingService).init();
  }
}
