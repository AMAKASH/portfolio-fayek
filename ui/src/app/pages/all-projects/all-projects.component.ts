import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { HeaderComponent } from '../../core/header/header.component';
import { ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-all-projects',
  standalone: true,
  imports: [HeaderComponent, RouterLink],
  templateUrl: './all-projects.component.html',
  styleUrl: './all-projects.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllProjectsComponent {
  readonly projects = toSignal(inject(ProjectService).list().pipe(catchError(() => of(null))), {
    initialValue: undefined,
  });
}
