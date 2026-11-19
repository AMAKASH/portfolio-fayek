import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AutoplayInViewDirective } from '../autoplay-in-view.directive';
import { MediaItem, ProjectView } from '../../core/models/project';

/**
 * The case-study layout (hero, info panel, content blocks).
 * Used by the public /works/:slug page AND the admin live preview, so what the
 * admin sees is exactly what gets published.
 *
 * Responsive rules use container queries (the host is the container) instead of
 * viewport media queries, so the admin preview can render the mobile layout
 * inside a narrow frame.
 */
@Component({
  selector: 'app-project-view',
  standalone: true,
  imports: [AutoplayInViewDirective, NgTemplateOutlet],
  templateUrl: './project-view.component.html',
  styleUrl: './project-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectViewComponent {
  @Input({ required: true }) project!: ProjectView;
  /** Hero video autoplays immediately (above the fold). Disable in the admin preview to save bandwidth. */
  @Input() heroAutoplay = true;

  allImages(items: MediaItem[]): boolean {
    return items.every((i) => i.kind === 'image');
  }
}
