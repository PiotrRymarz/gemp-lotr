import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CardInfoService } from '../../core/cards/card-info.service';
import { IntervalTimer, StopTimer } from '../../core/platform/interval-timer';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { CONNECTION_LOST, DRAFT_FINISHED, NO_TABLE_DRAFT_EVENT } from '../../core/table-draft/table-draft-messages';
import { TABLE_DRAFT_SERVICES } from '../../core/table-draft/table-draft-services';
import { readServerResponse } from '../../testing/files';
import { provideFakeNotifier, settle } from '../../testing/fake-notifier';
import { TableDraftPageComponent } from './table-draft-page.component';

const DRAFT = '/gemp-lotr-server/tableDraft/tdraft-1';

/** The polling timer, ticked by hand. */
class FakeTimer extends IntervalTimer {
  ticks: (() => void)[] = [];

  override every(_ms: number, tick: () => void): StopTimer {
    this.ticks.push(tick);
    return () => (this.ticks = this.ticks.filter((t) => t !== tick));
  }

  tick(): void {
    this.ticks.forEach((t) => t());
  }
}

describe('TableDraftPageComponent', () => {
  let backend: HttpTestingController;
  let timer: FakeTimer;

  function configure(queryString = '?eventId=tdraft-1') {
    timer = new FakeTimer();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeNotifier(),
        ...TABLE_DRAFT_SERVICES,
        { provide: IntervalTimer, useValue: timer },
        { provide: PAGE_QUERY_STRING, useValue: queryString },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  }

  afterEach(() => backend.verify());

  const poll = (): TestRequest => backend.expectOne((req) => req.url === DRAFT && req.method === 'GET');

  async function render() {
    const fixture = TestBed.createComponent(TableDraftPageComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const picks = () => Array.from(el.querySelectorAll<HTMLButtonElement>('gd-draft-picks .gd-card'));
    const drafted = () => Array.from(el.querySelectorAll<HTMLButtonElement>('gd-drafted-pool .gd-card'));
    const message = () => el.querySelector('.gd-table-draft__message')!.textContent!.trim();
    const seats = () => el.querySelector('.gd-table-draft__seats')!.textContent;
    const update = async () => {
      await settle();
      await fixture.whenStable();
    };
    return { fixture, el, picks, drafted, message, seats, update };
  }

  async function loaded(response = 'table-draft-status.xml') {
    configure();
    const page = await render();
    poll().flush(readServerResponse(response));
    await page.update();
    return page;
  }

  it('lays out the picks with the message and the table, the separator, the drafted cards, the chat and the tabs', async () => {
    configure();
    const { el } = await render();
    backend.match(() => true);
    expect(el.classList).toContain('gd-table-draft');
    expect(Array.from(el.children).map((child) => child.className || child.tagName.toLowerCase())).toEqual([
      'gd-table-draft__picks',
      'gd-table-draft__separator',
      'gd-table-draft__drafted',
      'gd-table-draft__chat',
      'gd-page__tabs',
      'gd-card-info',
    ]);
    const picks = el.querySelector('.gd-table-draft__picks')!;
    expect(Array.from(picks.children).map((child) => child.className || child.tagName.toLowerCase())).toEqual([
      'gd-table-draft__message',
      'gd-table-draft__seats',
      'gd-draft-picks',
    ]);
    expect(el.querySelector('p.gd-table-draft__message[role="status"]')).not.toBeNull();
    expect(el.querySelector('.gd-table-draft__drafted > h2.gd-table-draft__heading')).not.toBeNull();
    expect(el.querySelector('.gd-table-draft__drafted > gd-drafted-pool')).not.toBeNull();
    expect(
      el.querySelector('.gd-table-draft__separator[role="separator"] > button.gd-table-draft__toggle'),
    ).not.toBeNull();
    // The chat comes with the shared chat: an empty, labelled region for now
    const chat = el.querySelector('section.gd-table-draft__chat')!;
    expect(chat.getAttribute('aria-label')).toBe('Chat');
    expect(chat.children.length).toBe(0);
    expect(
      Array.from(el.querySelectorAll<HTMLElement>('.gd-page__tabs > .gd-page__tab')).map((t) => t.dataset['pane']),
    ).toEqual(['picks', 'drafted', 'chat']);
  });

  it('is loading until the first answer, then shows the line, the table, the pack and the pool', async () => {
    configure();
    const { el, picks, drafted, message, seats, update } = await render();
    expect(el.dataset['state']).toBe('loading');
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(message()).toBe('');
    poll().flush(readServerResponse('table-draft-status.xml'));
    await update();
    expect(el.dataset['state']).toBe('picking');
    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(message()).toBe('Make a pick - Pack 1/3 (1:05)');
    expect(seats()).toBe('alice > bob > carol');
    const seatList = el.querySelector<HTMLElement>('ol.gd-table-draft__seats')!;
    expect(seatList.dataset['direction']).toBe('down');
    expect(
      Array.from(seatList.querySelectorAll<HTMLElement>('li.gd-table-draft__seat')).map((s) => s.dataset['chosen']),
    ).toEqual([undefined, '', undefined]);
    expect(seatList.querySelectorAll('li')[1].getAttribute('aria-label')).toBe('bob, has picked');
    expect(picks().map((c) => c.dataset['choice'])).toEqual(['1_2', '1_45*', '1_2']);
    expect(picks().some((c) => c.dataset['chosen'] !== undefined)).toBe(false);
    expect(drafted().map((c) => c.getAttribute('aria-label'))).toEqual(['1_1', '1_13', '1_13']);
    expect(el.querySelector('.gd-table-draft__count')!.textContent).toBe('3');
  });

  it('declares a card on a click: busy meanwhile, then every copy of it marked and the line waiting', async () => {
    const { el, picks, message, update } = await loaded();
    picks()[0].click();
    await update();
    expect(el.dataset['busy']).toBe('');
    // No poll while a card is declared
    timer.tick();
    const declare = backend.expectOne((req) => req.url === DRAFT && req.method === 'POST');
    expect(declare.request.body.toString()).toContain('choiceId=1_2');
    declare.flush(readServerResponse('table-draft-chosen.xml'));
    await update();
    expect(el.dataset['busy']).toBeUndefined();
    expect(el.dataset['state']).toBe('waiting');
    expect(message()).toBe('Waiting for others to pick a card - Pack 1/3 (0:58)');
    expect(picks().map((c) => c.dataset['chosen'])).toEqual(['', undefined, '']);
    expect(
      Array.from(el.querySelectorAll<HTMLElement>('li.gd-table-draft__seat')).map((s) => s.dataset['chosen']),
    ).toEqual(['', '', undefined]);
  });

  it('polls, showing the next pack and the way it passes, and stops once the draft is finished', async () => {
    const { el, picks, drafted, message, seats, update } = await loaded();
    timer.tick();
    poll().flush(readServerResponse('table-draft-next-pick.xml'));
    await update();
    expect(message()).toBe('Make a pick - Pack 2/3');
    expect(seats()).toBe('alice < bob < carol');
    expect(el.querySelector<HTMLElement>('.gd-table-draft__seats')!.dataset['direction']).toBe('up');
    expect(picks().map((c) => c.dataset['choice'])).toEqual(['1_7', '1_12']);
    // One copy more: added after the others
    expect(drafted().map((c) => c.getAttribute('aria-label'))).toEqual(['1_1', '1_13', '1_13', '1_2']);

    timer.tick();
    poll().flush(readServerResponse('table-draft-finished.xml'));
    await update();
    expect(el.dataset['state']).toBe('finished');
    expect(message()).toBe(DRAFT_FINISHED);
    expect(picks()).toEqual([]);
    expect(timer.ticks).toEqual([]);
  });

  it('shows the card information on a shift-click or right-click, for picks and drafted cards', async () => {
    const { el, picks, drafted, update } = await loaded();
    const info = TestBed.inject(CardInfoService);
    drafted()[1].click();
    expect(info.card()).toBeNull();
    drafted()[1].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
    expect(info.card()).toEqual({ kind: 'drafted', blueprintId: '1_13' });
    picks()[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(info.card()).toMatchObject({ kind: 'draftChoice', blueprintId: '1_45*' });
    await update();
    expect(el.querySelector('dialog.gd-card-info')).not.toBeNull();
    backend.expectNone((req) => req.method === 'POST');
  });

  it('says why there is nothing without ?eventId=, and asks nothing', async () => {
    configure('');
    const { el, message, seats } = await render();
    expect(el.dataset['state']).toBe('no-event');
    expect(message()).toBe(NO_TABLE_DRAFT_EVENT);
    expect(seats()).toBe('');
    expect(el.querySelector('.gd-table-draft__notices')).toBeNull();
    expect(timer.ticks).toEqual([]);
  });

  it('shows the warnings once a poll failed, and polls again on "Try again"', async () => {
    const { el, picks, message, update } = await loaded();
    timer.tick();
    poll().flush('', { status: 500, statusText: 'Server Error' });
    await update();
    expect(el.dataset['state']).toBe('lost');
    expect(message()).toBe('');
    expect(timer.ticks).toEqual([]);
    const notices = el.querySelector<HTMLElement>('.gd-table-draft__notices[role="alert"]')!;
    expect(Array.from(notices.querySelectorAll('p.gd-table-draft__notice')).map((p) => p.textContent)).toEqual([
      ...CONNECTION_LOST,
    ]);

    notices.querySelector<HTMLButtonElement>('button.gd-table-draft__retry')!.click();
    poll().flush(readServerResponse('table-draft-status.xml'));
    await update();
    expect(el.dataset['state']).toBe('picking');
    expect(el.querySelector('.gd-table-draft__notices')).toBeNull();
    expect(picks().length).toBe(3);
    expect(timer.ticks.length).toBe(1);
  });

  it('stops polling when the page is left', async () => {
    const { fixture } = await loaded();
    expect(timer.ticks.length).toBe(1);
    fixture.destroy();
    expect(timer.ticks).toEqual([]);
  });

  it('closes and opens the picks with the separator, and shows the pane chosen in the tab bar', async () => {
    const { fixture, el } = await loaded();
    const tab = (pane: string) => el.querySelector<HTMLButtonElement>(`.gd-page__tab[data-pane="${pane}"]`)!;
    const separator = el.querySelector<HTMLElement>('.gd-table-draft__separator')!;
    const toggle = el.querySelector<HTMLButtonElement>('.gd-table-draft__toggle')!;
    toggle.click();
    await fixture.whenStable();
    expect(el.dataset['picks']).toBe('closed');
    expect(el.querySelector<HTMLElement>('.gd-table-draft__picks')!.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(el.dataset['picks']).toBe('open');
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(el.style.getPropertyValue('--gd-picks-height')).toBe('10px');

    expect(el.dataset['pane']).toBe('picks');
    toggle.click();
    tab('chat').click();
    await fixture.whenStable();
    expect(el.dataset['pane']).toBe('chat');
    expect(tab('chat').getAttribute('aria-selected')).toBe('true');
    expect(tab('chat').getAttribute('aria-controls')).toBe('gd-pane-chat');
    tab('picks').click();
    await fixture.whenStable();
    expect(el.dataset['pane']).toBe('picks');
    expect(el.dataset['picks']).toBe('open');
  });
});
