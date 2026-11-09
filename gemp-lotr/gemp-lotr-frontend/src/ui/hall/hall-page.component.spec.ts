import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CHAT_CHOICE_KEY } from '../../core/chat/chat-messages';
import { HALL_SERVICES } from '../../core/hall/hall-services';
import { HALL_TAB_STORAGE_KEY } from '../../core/hall/hall-tabs';
import { LocalSettings } from '../../core/platform/local-settings.service';
import { PAGE_HASH, PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { readServerResponse } from '../../testing/files';
import { settle } from '../../testing/fake-notifier';
import { CHAT_HEIGHT_KEY, CHAT_RESIZE_STEP, HallPageComponent } from './hall-page.component';

const HALL = '/gemp-lotr-server/hall';
const CHAT = '/gemp-lotr-server/chat/Game%20Hall';
const PLAYER = '/gemp-lotr-server/player';
const IGNORES = '/gemp-lotr-server/player/ignores';

class MemorySettings {
  readonly values = new Map<string, string>();
  read(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  write(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('HallPageComponent', () => {
  let backend: HttpTestingController;
  let settings: MemorySettings;

  function configure(hash = '', stored: Record<string, string> = {}) {
    settings = new MemorySettings();
    Object.entries({ [CHAT_CHOICE_KEY]: 'builtin', ...stored }).forEach(([key, value]) => settings.write(key, value));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLocationMocks(),
        ...HALL_SERVICES,
        { provide: LocalSettings, useValue: settings },
        { provide: PAGE_HASH, useValue: hash },
        { provide: PAGE_QUERY_STRING, useValue: '' },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    backend.match(() => true);
    TestBed.resetTestingModule();
  });

  async function render() {
    const fixture = TestBed.createComponent(HallPageComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const update = async () => {
      await settle();
      await fixture.whenStable();
    };
    const all = (selector: string) => Array.from(el.querySelectorAll<HTMLElement>(selector));
    const tab = (slug: string) => el.querySelector<HTMLButtonElement>(`.gd-hall__tab[data-tab="${slug}"]`)!;
    const panel = (slug: string) => el.querySelector<HTMLElement>(`.gd-hall__panel[data-tab="${slug}"]`)!;
    return { fixture, el, update, all, tab, panel };
  }

  /** Answers the hall's first calls: the player, the hall snapshot, the chat and the ignore list. */
  async function answer(update: () => Promise<void>, player: object = { name: 'alice', type: 'u' }) {
    backend.expectOne((r) => r.url === PLAYER).flush(player);
    backend.expectOne((r) => r.url === HALL && r.method === 'GET').flush(readServerResponse('hall.xml'));
    backend.expectOne((r) => r.url === CHAT && r.method === 'GET').flush(readServerResponse('chat.xml'));
    await update();
    backend.match((r) => r.url === IGNORES).forEach((req) => req.flush({ ignored: ['carol'] }));
    await update();
  }

  it('lays out the tabs and their panels, the main bar, the chat and the disclaimer', async () => {
    configure();
    const { el, all, update, panel } = await render();
    await answer(update);

    expect(el.classList).toContain('gd-hall');
    expect(el.dataset['tab']).toBe('game-hall');
    expect(el.querySelector('.gd-hall__tabs')!.getAttribute('role')).toBe('tablist');
    const tabs = all('.gd-hall__tab');
    // Users is hidden, Admin is for admins only
    expect(tabs.map((t) => [t.dataset['tab'], t.textContent!.trim(), t.getAttribute('aria-selected')])).toEqual([
      ['game-hall', 'Game Hall', 'true'],
      ['help', 'Help', 'false'],
      ['events', 'Events', 'false'],
      ['info', 'Server Info', 'false'],
      ['account', 'My Account', 'false'],
    ]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    expect(tabs[0].getAttribute('aria-controls')).toBe('gd-hall-panel-game-hall');

    const panels = all('.gd-hall__panel');
    expect(panels.map((p) => [p.dataset['tab'], p.getAttribute('role'), p.hidden])).toEqual([
      ['game-hall', 'tabpanel', false],
      ['help', 'tabpanel', true],
      ['events', 'tabpanel', true],
      ['info', 'tabpanel', true],
      ['account', 'tabpanel', true],
    ]);
    expect(all('gd-hall-placeholder').map((p) => p.getAttribute('aria-label'))).toEqual([
      'Tables — coming in 4.2',
      'Help — coming in 4.3',
      'Events — coming in 4.4',
      'Server Info — coming in 4.3',
      'My Account — coming in 4.4',
    ]);

    // The Game Hall's top: the link buttons (new tabs) and the MOTD, drawn from its markup
    const links = Array.from(panel('game-hall').querySelectorAll<HTMLAnchorElement>('.gd-hall__link'));
    expect(links.map((a) => [a.dataset['link'], a.textContent!.trim(), a.target])).toEqual([
      ['bug', 'Report a Bug', '_blank'],
      ['report', 'Report a Player', '_blank'],
      ['discord', 'Join the PC Discord', '_blank'],
      ['wiki', 'Browse the LOTR-TCG Wiki', '_blank'],
      ['merchant', 'Merchant', '_blank'],
    ]);
    expect(links[4].querySelector('s')).not.toBeNull();
    const motd = el.querySelector('.gd-hall__motd')!;
    expect(motd.textContent!.trim()).toBe('MOTD: Welcome back!');
    expect(motd.querySelector('gd-markup')!.innerHTML).toBe('Welcome <b>back</b>!');

    // The main bar: the readout, Deck-builder and Play, the server clock
    expect(el.querySelector<HTMLElement>('gd-hall-connection')!.dataset['state']).toBe('connected');
    const deckbuilder = el.querySelector<HTMLAnchorElement>('.gd-hall__action[data-action=deckbuilder]')!;
    expect([deckbuilder.getAttribute('href'), deckbuilder.target]).toEqual(['/gemp-lotr/ng/deckbuilder', '_blank']);
    expect(el.querySelector('.gd-hall__action[data-action=play]')!.tagName).toBe('BUTTON');
    expect(
      el
        .querySelector('.gd-hall__clock')!
        .innerHTML.replace(/<!--.*?-->/g, '')
        .trim(),
    ).toBe('2026-11-09<br>14:03:05');

    // The chat: its lines and players
    expect(el.dataset['chat']).toBe('builtin');
    expect(all('gd-chat .gd-chat__message')).toHaveLength(5);
    expect(all('gd-chat .gd-chat__user').map((u) => u.querySelector('.gd-chat__name')!.textContent)).toEqual([
      'alice',
      'bob',
      'carol',
      'dave',
    ]);
    expect(el.querySelector<HTMLElement>('gd-chat .gd-chat__user:nth-child(3)')!.dataset['ignored']).toBe('');
    expect(el.querySelector('.gd-hall__disclaimer')!.textContent).toContain('copyrighted by Decipher Inc.');
    expect(el.querySelector('.gd-hall__resizer')!.getAttribute('role')).toBe('separator');
  });

  it('opens the tab of the link, else the one last opened, else the Game Hall', async () => {
    configure('#help/formats', { [HALL_TAB_STORAGE_KEY]: 'events' });
    let page = await render();
    expect(page.el.dataset['tab']).toBe('help');
    TestBed.resetTestingModule();

    configure('', { [HALL_TAB_STORAGE_KEY]: 'my-account' });
    page = await render();
    expect(page.el.dataset['tab']).toBe('account');
    TestBed.resetTestingModule();

    configure('#no-such-tab', { [HALL_TAB_STORAGE_KEY]: 'includes/help.html' });
    page = await render();
    expect(page.el.dataset['tab']).toBe('game-hall');
  });

  it('switches tabs by click and arrow keys, remembering the tab and writing its link', async () => {
    configure();
    const { el, tab, panel, update } = await render();
    await answer(update);
    const location = TestBed.inject(Location);

    tab('info').click();
    await update();
    expect(el.dataset['tab']).toBe('info');
    expect(panel('info').hidden).toBe(false);
    expect(panel('game-hall').hidden).toBe(true);
    expect(settings.read(HALL_TAB_STORAGE_KEY)).toBe('info');
    expect(location.path(true)).toMatch(/#info$/);

    tab('info').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await update();
    expect(el.dataset['tab']).toBe('account');
    expect(document.activeElement).toBe(tab('account'));
    tab('account').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await update();
    expect(el.dataset['tab']).toBe('game-hall');
    tab('game-hall').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await update();
    expect(el.dataset['tab']).toBe('account');
  });

  it('shows the Admin tab to admins', async () => {
    configure('#admin');
    const { el, all, update } = await render();
    // Opened on the Admin tab: shown once the player is known to be an admin
    expect(el.dataset['tab']).toBe('game-hall');
    await answer(update, { name: 'alice', type: 'ua' });
    expect(all('.gd-hall__tab').map((t) => t.dataset['tab'])).toContain('admin');
    expect(el.dataset['tab']).toBe('admin');
    expect(el.querySelector('gd-hall-placeholder[data-tab=admin]')!.getAttribute('aria-label')).toBe(
      'Admin — coming in 4.5',
    );
  });

  it('on a public tab, a visitor reads on; opening a tab that needs logging in asks them to log in', async () => {
    configure('#help');
    const { el, tab, update } = await render();
    backend.expectOne((r) => r.url === PLAYER).flush('', { status: 401, statusText: 'Unauthorized' });
    await update();
    backend.expectNone((r) => r.url === HALL);
    expect(el.querySelector<HTMLElement>('gd-hall-connection')!.dataset['state']).toBe('loggedout');
    expect(el.querySelector('gd-chat .gd-chat__message[data-kind=warning]')!.textContent).toContain(
      'You are not logged in.',
    );
    expect(el.querySelector('gd-chat .gd-chat__login')!.getAttribute('href')).toBe('/gemp-lotr/#help');
    const dialog = () => el.querySelector<HTMLDialogElement>('dialog[data-dialog=login-required]')!;
    expect(dialog().open).toBe(false);

    // the hall starts; its answers say the viewer is not logged in
    tab('account').click();
    await update();
    backend.expectOne((r) => r.url === HALL).flush('', { status: 401, statusText: 'Unauthorized' });
    backend.expectOne((r) => r.url === CHAT).flush('', { status: 401, statusText: 'Unauthorized' });
    await update();
    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain('Help and Server Info can be read without.');
    expect(dialog().querySelector('a[data-action=login]')!.getAttribute('href')).toBe('/gemp-lotr/#account');
    dialog().querySelector<HTMLButtonElement>('[data-action=close]')!.click();
    await update();
    expect(dialog().open).toBe(false);

    el.querySelector<HTMLButtonElement>('.gd-hall__action[data-action=play]')!.click();
    await update();
    expect(dialog().open).toBe(true);
  });

  it('asks to log in when the poll finds the viewer not logged in on the Game Hall', async () => {
    configure();
    const { el, update } = await render();
    backend.expectOne((r) => r.url === PLAYER).flush('', { status: 401, statusText: 'Unauthorized' });
    backend.expectOne((r) => r.url === HALL).flush('', { status: 401, statusText: 'Unauthorized' });
    backend.expectOne((r) => r.url === CHAT).flush('', { status: 401, statusText: 'Unauthorized' });
    await update();
    expect(el.querySelector<HTMLElement>('gd-hall-connection')!.dataset['state']).toBe('loggedout');
    expect(el.querySelector<HTMLDialogElement>('dialog[data-dialog=login-required]')!.open).toBe(true);
    expect(el.querySelector<HTMLElement>('gd-chat')!.dataset['stopped']).toBe('');
  });

  it('resizes the chat with Up and Down, remembering its height', async () => {
    configure('', { [CHAT_HEIGHT_KEY]: '240' });
    const { el, update } = await render();
    expect(el.style.getPropertyValue('--gd-chat-height')).toBe('240px');
    const bar = el.querySelector<HTMLElement>('.gd-hall__resizer')!;
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await update();
    expect(el.style.getPropertyValue('--gd-chat-height')).toBe(`${240 + CHAT_RESIZE_STEP}px`);
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await update();
    expect(el.style.getPropertyValue('--gd-chat-height')).toBe(`${240 - CHAT_RESIZE_STEP}px`);
    expect(settings.read(CHAT_HEIGHT_KEY)).toBe(String(240 - CHAT_RESIZE_STEP));
  });

  it('sends what is typed, and keeps the Discord choice', async () => {
    configure();
    const { el, update } = await render();
    await answer(update);
    const box = el.querySelector<HTMLTextAreaElement>('.gd-chat__input')!;
    box.value = 'hello';
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await update();
    const sent = backend.match((r) => r.url === CHAT && r.method === 'POST' && r.body?.get?.('message') === 'hello');
    expect(sent).toHaveLength(1);

    el.querySelector<HTMLButtonElement>('.gd-chat__switch')!.click();
    await update();
    expect(settings.read(CHAT_CHOICE_KEY)).toBe('discord');
    expect(el.dataset['chat']).toBe('discord');
    document.head.querySelectorAll('script[data-gd-widgetbot]').forEach((s) => s.remove());
  });

  it('stops the hall and the chat when the page goes', async () => {
    configure();
    const { fixture, update } = await render();
    await answer(update);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const polls = backend.match((r) => r.method === 'POST');
    expect(polls.map((r) => r.request.url).sort()).toEqual([CHAT, `${HALL}/update`]);
    fixture.destroy();
    expect(polls.every((r) => r.cancelled)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    backend.expectNone(() => true);
  });
});
