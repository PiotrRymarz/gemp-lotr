import { Routes } from '@angular/router';
import { DECKBUILDER_SERVICES } from '../../core/actions/deckbuilder-services';
import { LOGIN_SERVICES } from '../../core/login/login-services';
import { MERCHANT_SERVICES } from '../../core/merchant/merchant-services';
import { SOLO_DRAFT_SERVICES } from '../../core/solo-draft/solo-draft-services';
import { MERCHANT_VIEW_PROVIDERS } from '../merchant/merchant-notifier';
import { loadThemePage } from './theme-pages';

/**
 * The app's pages, each loaded on first use, under the app's base href (/gemp-lotr/ng/): /gemp-lotr/ng/<path>. The
 * server answers every such address with the app's index.html (WebRequestHandler), so a page can be reloaded or
 * linked to directly. A route with theme CSS of its own names its page in `data.page` (a bundle
 * `theme-<theme>-<page>.css` per theme, see ThemeService) and waits for it with `resolve: { themePage: loadThemePage }`.
 * A page's own services (its state) go in its route's `providers`, so they belong to the page, not the app.
 */
export const APP_ROUTES: Routes = [
  {
    path: 'deckbuilder',
    title: 'GEMP: LotR-TCG - Deckbuilder',
    data: { page: 'deckbuilder' },
    resolve: { themePage: loadThemePage },
    providers: DECKBUILDER_SERVICES,
    loadComponent: () => import('../deckbuilder/deckbuilder-page.component').then((m) => m.DeckbuilderPageComponent),
  },
  {
    path: 'login',
    title: 'GEMP: LotR-TCG - Login',
    data: { page: 'login' },
    resolve: { themePage: loadThemePage },
    providers: LOGIN_SERVICES,
    loadComponent: () => import('../login/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'merchant',
    title: 'GEMP: LotR-TCG - Merchant',
    data: { page: 'merchant' },
    resolve: { themePage: loadThemePage },
    providers: [...MERCHANT_SERVICES, ...MERCHANT_VIEW_PROVIDERS],
    loadComponent: () => import('../merchant/merchant-page.component').then((m) => m.MerchantPageComponent),
  },
  {
    // Opened from the hall and the league page with ?eventId= (a tournament id or a league code); no shell link
    path: 'draft/solo',
    title: 'GEMP: LotR-TCG - Draft',
    data: { page: 'solo-draft' },
    resolve: { themePage: loadThemePage },
    providers: SOLO_DRAFT_SERVICES,
    loadComponent: () => import('../solo-draft/solo-draft-page.component').then((m) => m.SoloDraftPageComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'deckbuilder' },
  { path: '**', redirectTo: 'deckbuilder' },
];
