import { EnvironmentProviders, inject, makeEnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  ResolveFn,
  Router,
} from '@angular/router';
import { ThemeService } from '../../core/platform/theme.service';

/** A route's page, for its theme CSS: `data: { page: 'deckbuilder' }` (app.routes.ts). */
export function routePage(route: ActivatedRouteSnapshot | null): string | null {
  let page: string | null = null;
  for (let at = route; at; at = at.firstChild) {
    const own: unknown = at.data['page'];
    if (typeof own === 'string') {
      page = own;
    }
  }
  return page;
}

/**
 * A route's resolver (`resolve: { themePage: loadThemePage }`): the page isn't shown before the current theme's
 * stylesheet for it has loaded.
 */
export const loadThemePage: ResolveFn<void> = (route) => inject(ThemeService).loadPage(routePage(route));

/** Once a navigation is over (shown, cancelled or failed), keeps only the stylesheets of the page on screen. */
export function provideThemePages(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const router = inject(Router);
      const themes = inject(ThemeService);
      router.events.subscribe((event) => {
        if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
          void themes.setPage(routePage(router.routerState.snapshot.root));
        }
      });
    }),
  ]);
}
