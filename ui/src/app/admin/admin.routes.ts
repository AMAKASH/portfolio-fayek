import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '../core/auth/auth.guard';
import { AdminRootComponent } from './admin-root.component';
import { unsavedChangesGuard } from './shared/unsaved-changes.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminRootComponent,
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        title: 'Sign in | Admin',
        loadComponent: () => import('./login/login.component').then((c) => c.LoginComponent),
      },
      {
        path: '',
        canActivate: [authGuard],
        loadComponent: () => import('./layout/admin-layout.component').then((c) => c.AdminLayoutComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'projects' },
          {
            path: 'projects',
            title: 'Projects | Admin',
            loadComponent: () => import('./projects/project-list.component').then((c) => c.ProjectListComponent),
          },
          {
            path: 'projects/new',
            title: 'New project | Admin',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('./projects/editor/project-editor.component').then((c) => c.ProjectEditorComponent),
          },
          {
            path: 'projects/:id',
            title: 'Edit project | Admin',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('./projects/editor/project-editor.component').then((c) => c.ProjectEditorComponent),
          },
          {
            path: 'home',
            title: 'Home page | Admin',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () => import('./home/home-settings.component').then((c) => c.HomeSettingsComponent),
          },
          {
            path: 'featured',
            title: 'Landing tiles | Admin',
            loadComponent: () => import('./featured/featured.component').then((c) => c.FeaturedComponent),
          },
          {
            path: 'media',
            title: 'Media | Admin',
            loadComponent: () => import('./media/media-library.component').then((c) => c.MediaLibraryComponent),
          },
          {
            path: 'account',
            title: 'Account | Admin',
            loadComponent: () => import('./account/account.component').then((c) => c.AccountComponent),
          },
        ],
      },
    ],
  },
];
