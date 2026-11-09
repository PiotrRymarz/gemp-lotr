import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { PlayerService } from '../../core/session/player.service';
import { routePage } from '../app/theme-pages';
import { NotifierDialogComponent } from '../shared/notifier/notifier-dialog.component';
import { MenuComponent } from './menu.component';
import { SettingsComponent } from './settings.component';
import { SettingsService } from './settings.service';
import { HALL_HREF, SHELL_LINKS } from './shell-links';

/**
 * What every page shares around it: a header (the app's title, leading to the hall; the navigation, as links and as a
 * menu for narrow screens; the logged-in player; the settings button), the page itself (projected: the router
 * outlet), the settings dialog and the Notifier's dialog (one for every page). The theme decides what of the header it shows on which page (`data-page`).
 *
 * DOM contract: `gd-shell.gd-shell` (`data-page` = the page shown, its route's `data.page`) holding
 * `header.gd-shell__header` with `a.gd-shell__title`, `nav.gd-shell__nav` (an `a.gd-shell__link` per page of
 * SHELL_LINKS: `data-page`, `aria-current=page` on the page shown), `.gd-shell__player` (the player's name, once known),
 * `gd-menu` and `button.gd-button[data-action=settings]`; then the page, then `gd-settings` and `gd-notifier`.
 */
@Component({
  selector: 'gd-shell',
  imports: [RouterLink, MenuComponent, SettingsComponent, NotifierDialogComponent],
  host: { class: 'gd-shell', '[attr.data-page]': 'page()' },
  template: `
    <header class="gd-shell__header">
      <a class="gd-shell__title" [href]="hall">GEMP: LotR-TCG</a>
      <nav class="gd-shell__nav" aria-label="Pages">
        @for (link of links; track link.page) {
          @if ('route' in link) {
            <a
              class="gd-shell__link"
              [routerLink]="link.route"
              [attr.data-page]="link.page"
              [attr.aria-current]="link.page === page() ? 'page' : null"
              >{{ link.label }}</a
            >
          } @else {
            <a class="gd-shell__link" [href]="link.href" [attr.data-page]="link.page">{{ link.label }}</a>
          }
        }
      </nav>
      @if (player.player(); as player) {
        <span class="gd-shell__player">{{ player.name }}</span>
      }
      <gd-menu [links]="links" [current]="page()" />
      <button
        type="button"
        class="gd-button"
        data-action="settings"
        title="Settings"
        aria-label="Settings"
        aria-haspopup="dialog"
        (click)="settings.show()"
      ></button>
    </header>
    <ng-content />
    <gd-settings />
    <gd-notifier />
  `,
})
export class ShellComponent {
  private readonly router = inject(Router);
  protected readonly player = inject(PlayerService);
  protected readonly settings = inject(SettingsService);
  protected readonly links = SHELL_LINKS;
  protected readonly hall = HALL_HREF;

  protected readonly page = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => routePage(this.router.routerState.snapshot.root)),
    ),
    { initialValue: null },
  );

  constructor() {
    // Who is logged in; a failure leaves the name out
    this.player.load().catch(() => undefined);
  }
}
