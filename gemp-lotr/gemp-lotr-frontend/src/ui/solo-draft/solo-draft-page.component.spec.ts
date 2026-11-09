import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GENERIC_COMMUNICATION_ERROR } from '../../core/api/api-error';
import { CardInfoService } from '../../core/cards/card-info.service';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { DRAFT_FINISHED, MAKE_A_PICK, NO_DRAFT_EVENT } from '../../core/solo-draft/solo-draft-messages';
import { SOLO_DRAFT_SERVICES } from '../../core/solo-draft/solo-draft-services';
import { readServerResponse } from '../../testing/files';
import { FakeNotifier, provideFakeNotifier, settle } from '../../testing/fake-notifier';
import { RESIZE_STEP, SoloDraftPageComponent } from './solo-draft-page.component';

const DRAFT = '/gemp-lotr-server/soloDraft/20261101';
const COLLECTION = '/gemp-lotr-server/collection/20261101';

describe('SoloDraftPageComponent', () => {
  let backend: HttpTestingController;

  function configure(queryString = '?eventId=20261101') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeNotifier(),
        ...SOLO_DRAFT_SERVICES,
        { provide: PAGE_QUERY_STRING, useValue: queryString },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  }

  afterEach(() => backend.verify());

  async function render() {
    const fixture = TestBed.createComponent(SoloDraftPageComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const picks = () => Array.from(el.querySelectorAll<HTMLButtonElement>('gd-draft-picks .gd-card'));
    const drafted = () => Array.from(el.querySelectorAll<HTMLButtonElement>('gd-drafted-pool .gd-card'));
    const message = () => el.querySelector('.gd-solo-draft__message')!.textContent!.trim();
    const update = async () => {
      await settle();
      await fixture.whenStable();
    };
    return { fixture, el, picks, drafted, message, update };
  }

  async function loaded(picks = 'solo-draft-picks.xml') {
    configure();
    const page = await render();
    backend.expectOne((req) => req.url === DRAFT && req.method === 'GET').flush(readServerResponse(picks));
    backend.expectOne((req) => req.url === COLLECTION).flush(readServerResponse('solo-draft-collection.xml'));
    await page.update();
    return page;
  }

  it('lays out the picks, the separator, the drafted cards and the tab bar', async () => {
    configure();
    const { el } = await render();
    backend.match(() => true);
    expect(el.classList).toContain('gd-solo-draft');
    expect(Array.from(el.children).map((child) => child.className || child.tagName.toLowerCase())).toEqual([
      'gd-solo-draft__picks',
      'gd-solo-draft__separator',
      'gd-solo-draft__drafted',
      'gd-page__tabs',
      'gd-card-info',
    ]);
    expect(el.querySelector('.gd-solo-draft__picks > p.gd-solo-draft__message[role="status"]')).not.toBeNull();
    expect(el.querySelector('.gd-solo-draft__picks > gd-draft-picks')).not.toBeNull();
    expect(el.querySelector('.gd-solo-draft__drafted > h2.gd-solo-draft__heading')).not.toBeNull();
    expect(el.querySelector('.gd-solo-draft__drafted > gd-drafted-pool')).not.toBeNull();
    expect(
      el.querySelector('.gd-solo-draft__separator[role="separator"] > button.gd-solo-draft__toggle'),
    ).not.toBeNull();
  });

  it('is loading until both answers have arrived, then shows the picks and the drafted copies', async () => {
    configure();
    const { el, picks, drafted, message, update } = await render();
    expect(el.dataset['state']).toBe('loading');
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(message()).toBe('');
    backend.expectOne((req) => req.url === DRAFT).flush(readServerResponse('solo-draft-picks.xml'));
    await update();
    expect(el.dataset['state']).toBe('loading');
    backend.expectOne((req) => req.url === COLLECTION).flush(readServerResponse('solo-draft-collection.xml'));
    await update();
    expect(el.dataset['state']).toBe('picking');
    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(message()).toBe(MAKE_A_PICK);
    expect(picks().map((c) => c.dataset['choice'])).toEqual(['1_2', '1_45*', '1_319']);
    expect(drafted().map((c) => c.getAttribute('aria-label'))).toEqual(['1_1', '1_13', '1_13', '1_178']);
    expect(el.querySelector('.gd-solo-draft__count')!.textContent).toBe('4');
  });

  it('makes a pick on a click: busy meanwhile, then the picked cards after the others and the next picks', async () => {
    const { el, picks, drafted, message, update } = await loaded();
    picks()[0].click();
    await update();
    expect(el.dataset['busy']).toBe('');
    expect(picks()).toEqual([]);
    const pick = backend.expectOne((req) => req.url === DRAFT && req.method === 'POST');
    expect(pick.request.body.toString()).toContain('choiceId=1_2');
    pick.flush(readServerResponse('solo-draft-pick-result.xml'));
    await update();
    expect(el.dataset['busy']).toBeUndefined();
    expect(message()).toBe(MAKE_A_PICK);
    expect(picks().map((c) => c.dataset['choice'])).toEqual(['1_7', '1_12']);
    expect(drafted().map((c) => c.getAttribute('aria-label'))).toEqual(['1_1', '1_13', '1_13', '1_178', '1_2']);
  });

  it('says the draft is finished after the last pick', async () => {
    const { el, picks, message, update } = await loaded();
    picks()[2].click();
    backend.expectOne((req) => req.method === 'POST').flush(readServerResponse('solo-draft-last-pick-result.xml'));
    await update();
    expect(el.dataset['state']).toBe('finished');
    expect(message()).toBe(DRAFT_FINISHED);
    expect(picks()).toEqual([]);
  });

  it('shows the card information on a shift-click, for picks and drafted cards, and does nothing else', async () => {
    const { el, picks, drafted, update } = await loaded();
    const info = TestBed.inject(CardInfoService);
    drafted()[1].click();
    expect(info.card()).toBeNull();
    drafted()[1].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
    expect(info.card()).toEqual({ kind: 'drafted', blueprintId: '1_13' });
    picks()[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(info.card()).toMatchObject({ kind: 'draftChoice', blueprintId: '1_2' });
    await update();
    expect(el.querySelector('dialog.gd-card-info')).not.toBeNull();
  });

  it('says why there is nothing without ?eventId=, and asks nothing', async () => {
    configure('');
    const { el, message } = await render();
    expect(el.dataset['state']).toBe('no-event');
    expect(message()).toBe(NO_DRAFT_EVENT);
    expect(el.querySelector('.gd-solo-draft__error')).toBeNull();
  });

  it('shows the error, alerts, and loads the draft again on "Try again"', async () => {
    configure();
    const { el, picks, message, update } = await render();
    backend.expectOne((req) => req.url === DRAFT).flush('', { status: 500, statusText: 'Server Error' });
    // The drafted cards are no longer waited for (forkJoin drops them)
    expect(backend.expectOne((req) => req.url === COLLECTION).cancelled).toBe(true);
    await update();
    expect(el.dataset['state']).toBe('error');
    expect(message()).toBe('');
    const error = el.querySelector<HTMLElement>('.gd-solo-draft__error[role="alert"]')!;
    expect(error.querySelector('.gd-solo-draft__error-text')!.textContent).toBe(GENERIC_COMMUNICATION_ERROR);
    expect(TestBed.inject(FakeNotifier).dialogs).toEqual([`alert: ${GENERIC_COMMUNICATION_ERROR}`]);

    error.querySelector<HTMLButtonElement>('button.gd-solo-draft__retry')!.click();
    backend.expectOne((req) => req.url === DRAFT).flush(readServerResponse('solo-draft-picks.xml'));
    backend.expectOne((req) => req.url === COLLECTION).flush(readServerResponse('solo-draft-collection.xml'));
    await update();
    expect(el.dataset['state']).toBe('picking');
    expect(el.querySelector('.gd-solo-draft__error')).toBeNull();
    expect(picks().length).toBe(3);
  });

  it('closes and opens the picks with the toggle or Enter, and resizes them with the arrow keys', async () => {
    const { fixture, el } = await loaded();
    const separator = el.querySelector<HTMLElement>('.gd-solo-draft__separator')!;
    const toggle = el.querySelector<HTMLButtonElement>('.gd-solo-draft__toggle')!;
    const section = el.querySelector<HTMLElement>('.gd-solo-draft__picks')!;
    expect(el.dataset['picks']).toBe('open');

    toggle.click();
    await fixture.whenStable();
    expect(el.dataset['picks']).toBe('closed');
    expect(section.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(el.dataset['picks']).toBe('open');

    // jsdom lays nothing out: the picks are 0px high until the separator moves them
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(el.style.getPropertyValue('--gd-picks-height')).toBe(`${RESIZE_STEP}px`);
  });

  it('shows the pane chosen in the tab bar (for themes that show one at a time), opening the picks', async () => {
    const { fixture, el } = await loaded();
    const tab = (pane: string) => el.querySelector<HTMLButtonElement>(`.gd-page__tab[data-pane="${pane}"]`)!;
    expect(el.dataset['pane']).toBe('picks');
    expect(tab('picks').getAttribute('aria-selected')).toBe('true');
    el.querySelector<HTMLButtonElement>('.gd-solo-draft__toggle')!.click();
    tab('drafted').click();
    await fixture.whenStable();
    expect(el.dataset['pane']).toBe('drafted');
    expect(tab('drafted').getAttribute('aria-selected')).toBe('true');
    expect(el.dataset['picks']).toBe('closed');
    tab('picks').click();
    await fixture.whenStable();
    expect(el.dataset['pane']).toBe('picks');
    expect(el.dataset['picks']).toBe('open');
  });
});
