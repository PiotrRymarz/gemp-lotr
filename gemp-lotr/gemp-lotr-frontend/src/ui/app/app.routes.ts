import { Routes } from '@angular/router';
import { loadThemePage } from './theme-pages';

/**
 * The app's pages, each loaded on first use, under the app's base href (/gemp-lotr/ng/): /gemp-lotr/ng/<path>. The
 * server answers every such address with the app's index.html (WebRequestHandler), so a page can be reloaded or
 * linked to directly. A route with theme CSS of its own names its page in `data.page` (a bundle
 * `theme-<theme>-<page>.css` per theme, see ThemeService) and waits for it with `resolve: { themePage: loadThemePage }`.
 */
export const APP_ROUTES: Routes = [
  {
    path: 'deckbuilder',
    title: 'GEMP: LotR-TCG - Deckbuilder',
    data: { page: 'deckbuilder' },
    resolve: { themePage: loadThemePage },
    loadComponent: () => import('../deckbuilder/deckbuilder-page.component').then((m) => m.DeckbuilderPageComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'deckbuilder' },
  { path: '**', redirectTo: 'deckbuilder' },
];
