import { Routes } from '@angular/router';
import { projectResolver } from './pages/project-details/project.resolver';

export const routes: Routes = [
  {
    // Admin panel: its own lazy chunk, outside the public layout (no site header).
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./pages/pages.component').then((c) => c.PagesComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home.component').then((c) => c.HomeComponent),
      },
      {
        path: 'about',
        loadComponent: () => import('./pages/team-page/team-page.component').then((c) => c.TeamPageComponent),
      },
      {
        path: 'works',
        loadComponent: () =>
          import('./pages/all-projects/all-projects.component').then((c) => c.AllProjectsComponent),
      },
      {
        // :slug — numeric values (old /works/:idx links) are redirected by the resolver.
        path: 'works/:slug',
        resolve: { project: projectResolver },
        runGuardsAndResolvers: 'paramsChange',
        loadComponent: () =>
          import('./pages/project-details/project-details.component').then((c) => c.ProjectDetailsComponent),
      },
      {
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
