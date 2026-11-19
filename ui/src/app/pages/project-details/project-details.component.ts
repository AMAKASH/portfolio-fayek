import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { HeaderComponent } from '../../core/header/header.component';
import { PublicProject } from '../../core/models/project';
import { ProjectViewComponent } from '../../shared/project-view/project-view.component';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [HeaderComponent, RouterLink, ProjectViewComponent],
  templateUrl: './project-details.component.html',
  styleUrl: './project-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailsComponent {
  readonly project = signal<PublicProject | null>(null);

  private title = inject(Title);
  private meta = inject(Meta);

  constructor() {
    // The resolver re-runs on every slug change (prev/next), and the component is reused.
    inject(ActivatedRoute)
      .data.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((d) => {
        const p = d['project'] as PublicProject;
        this.project.set(p);
        this.setSeo(p);
      });
    // Other pages don't set a title, so restore the default when leaving.
    inject(DestroyRef).onDestroy(() => this.title.setTitle(environment.siteTitle));
  }

  private setSeo(p: PublicProject) {
    this.title.setTitle(`${p.seo.metaTitle || p.title} | ${environment.siteTitle}`);
    const description = p.seo.metaDescription || p.result || p.description;
    const image = p.seo.ogImage || p.hero.image || p.thumbnail;
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: p.seo.metaTitle || p.title });
    this.meta.updateTag({ property: 'og:description', content: description });
    if (image) this.meta.updateTag({ property: 'og:image', content: image });
  }
}
