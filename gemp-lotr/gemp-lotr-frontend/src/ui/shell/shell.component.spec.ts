import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { PlayerService } from '../../core/session/player.service';
import { readServerResponse } from '../../testing/files';
import { SettingsService } from './settings.service';
import { ShellComponent } from './shell.component';
import { SHELL_LINKS } from './shell-links';

@Component({ template: `<p class="page">A page</p>` })
class PageComponent {}

@Component({ imports: [ShellComponent, RouterOutlet], template: `<gd-shell><router-outlet /></gd-shell>` })
class HostComponent {}

describe('ShellComponent', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'deckbuilder', data: { page: 'deckbuilder' }, component: PageComponent },
          { path: 'other', component: PageComponent },
        ]),
        { provide: PAGE_QUERY_STRING, useValue: '' },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function render(url = '/deckbuilder') {
    const fixture = TestBed.createComponent(HostComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const shell = el.querySelector<HTMLElement>('gd-shell')!;
    return { fixture, el, shell };
  }

  const playerRequest = () => backend.expectOne((r) => r.url === '/gemp-lotr-server/player');

  it('wraps the page in a header and the settings, marked with the page shown (DOM contract)', async () => {
    const { shell } = await render();
    playerRequest().flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(shell.classList).toContain('gd-shell');
    expect(shell.dataset['page']).toBe('deckbuilder');
    expect(Array.from(shell.children).map((child) => child.localName + '.' + child.className)).toEqual([
      'header.gd-shell__header',
      'router-outlet.',
      'ng-component.',
      'gd-settings.',
      'gd-notifier.',
    ]);
    const header = shell.querySelector('.gd-shell__header')!;
    expect(Array.from(header.children).map((child) => child.className || child.localName)).toEqual([
      'gd-shell__title',
      'gd-shell__nav',
      'gd-menu',
      'gd-button',
    ]);
    expect(header.querySelector<HTMLAnchorElement>('a.gd-shell__title')!.getAttribute('href')).toBe(
      '/gemp-lotr/hall.html',
    );
    expect(header.querySelector('nav.gd-shell__nav')!.getAttribute('aria-label')).toBe('Pages');
    expect(header.lastElementChild!.getAttribute('data-action')).toBe('settings');
  });

  it('renders the navigation from SHELL_LINKS, marking the page shown', async () => {
    const { fixture, shell } = await render();
    playerRequest().flush(null, { status: 401, statusText: 'Unauthorized' });
    const links = () => Array.from(shell.querySelectorAll<HTMLAnchorElement>('nav.gd-shell__nav > a.gd-shell__link'));
    expect(links().map((a) => [a.dataset['page'], a.textContent!.trim()])).toEqual(
      SHELL_LINKS.map((link) => [link.page, link.label]),
    );
    expect(links().map((a) => a.getAttribute('href'))).toEqual(['/gemp-lotr/hall.html', '/deckbuilder', '/merchant']);
    expect(links().map((a) => a.getAttribute('aria-current'))).toEqual([null, 'page', null]);

    await TestBed.inject(Router).navigateByUrl('/other');
    await fixture.whenStable();
    expect(shell.hasAttribute('data-page')).toBe(false);
    expect(links().every((a) => !a.hasAttribute('aria-current'))).toBe(true);
  });

  it("shows the logged-in player's name once known", async () => {
    const { fixture, shell } = await render();
    expect(shell.querySelector('.gd-shell__player')).toBeNull();
    playerRequest().flush(readServerResponse('player.json'));
    await TestBed.inject(PlayerService).load();
    await fixture.whenStable();
    expect(shell.querySelector('.gd-shell__player')!.textContent).toBe('Visual tester');
  });

  it('leaves the name out when nobody is logged in, or the server fails', async () => {
    const { fixture, shell } = await render();
    playerRequest().flush('', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(shell.querySelector('.gd-shell__player')).toBeNull();
  });

  it('opens the settings from its settings button', async () => {
    const { fixture, shell } = await render();
    playerRequest().flush(null, { status: 401, statusText: 'Unauthorized' });
    const dialog = shell.querySelector<HTMLDialogElement>('gd-settings dialog.gd-dialog')!;
    expect(dialog.open).toBe(false);
    shell.querySelector<HTMLButtonElement>('.gd-shell__header [data-action="settings"]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(SettingsService).isOpen()).toBe(true);
    expect(dialog.open).toBe(true);
  });
});
