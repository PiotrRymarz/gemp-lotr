import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { readServerResponse } from '../../testing/files';
import { FakeNotifier, provideFakeNotifier, settle } from '../../testing/fake-notifier';
import { GENERIC_COMMUNICATION_ERROR } from '../api/api-error';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { CONNECTION_LOST, DRAFT_FINISHED, NO_TABLE_DRAFT_EVENT } from './table-draft-messages';
import { TABLE_DRAFT_SERVICES } from './table-draft-services';
import { TABLE_DRAFT_POLL_MS, TableDraftService } from './table-draft.service';

const DRAFT = '/gemp-lotr-server/tableDraft/tdraft-1';

describe('TableDraftService', () => {
  let backend: HttpTestingController;
  let notifier: FakeNotifier;

  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    backend.verify();
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  function create(queryString = '?eventId=tdraft-1'): TableDraftService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeNotifier(),
        ...TABLE_DRAFT_SERVICES,
        { provide: PAGE_QUERY_STRING, useValue: queryString },
      ],
    });
    notifier = TestBed.inject(FakeNotifier);
    backend = TestBed.inject(HttpTestingController);
    return TestBed.inject(TableDraftService);
  }

  const polls = (): TestRequest[] => backend.match((req) => req.url === DRAFT && req.method === 'GET');
  const poll = (): TestRequest => backend.expectOne((req) => req.url === DRAFT && req.method === 'GET');
  const pickCall = (): TestRequest => backend.expectOne((req) => req.url === DRAFT && req.method === 'POST');
  const tick = () => vi.advanceTimersByTime(TABLE_DRAFT_POLL_MS);

  /** Starts the page and answers its first poll. */
  function started(response = 'table-draft-status.xml'): TableDraftService {
    const service = create();
    service.start();
    poll().flush(readServerResponse(response));
    return service;
  }

  it('reads the event from ?eventId= and shows nothing before the first answer', () => {
    const service = create('?participantId=bob&eventId=tdraft-1');
    expect(service.eventId).toBe('tdraft-1');
    expect(service.phase()).toBe('loading');
    expect(service.message()).toBeNull();
    expect(service.choices()).toEqual([]);
    expect(service.players()).toEqual([]);
    backend.expectNone(DRAFT);
  });

  it('asks nothing without ?eventId=, and says so', async () => {
    const service = create('');
    service.start();
    await service.pick({ id: '1_2', blueprintId: '1_2', url: null });
    tick();
    expect(service.running).toBe(false);
    expect(service.phase()).toBe('noEvent');
    expect(service.message()).toBe(NO_TABLE_DRAFT_EVENT);
    expect(notifier.dialogs).toEqual([]);
  });

  it('shows the pack, the pool, the table and the time left', () => {
    const service = started();
    expect(service.phase()).toBe('picking');
    expect(service.message()).toBe('Make a pick - Pack 1/3 (1:05)');
    expect(service.choices().map((choice) => choice.id)).toEqual(['1_2', '1_45*', '1_2']);
    expect(service.draftedCopies()).toEqual(['1_1', '1_13', '1_13']);
    expect(service.draftedCount()).toBe(3);
    expect(service.players()).toEqual([
      { name: 'alice', hasChosen: false },
      { name: 'bob', hasChosen: true },
      { name: 'carol', hasChosen: false },
    ]);
    expect(service.passSeparator()).toBe(' > ');
    expect(service.notices()).toEqual([]);
    service.stop();
  });

  it('polls every 500 ms, one request at a time, until stopped', () => {
    const service = started();
    expect(service.running).toBe(true);
    tick();
    const first = poll();
    tick();
    tick();
    backend.expectNone(DRAFT);
    first.flush(readServerResponse('table-draft-status.xml'));
    tick();
    poll().flush(readServerResponse('table-draft-status.xml'));
    tick();
    const pending = poll();
    service.stop();
    expect(pending.cancelled).toBe(true);
    expect(service.running).toBe(false);
    tick();
    backend.expectNone(DRAFT);
  });

  it('keeps the same pack, seats and pool when nothing changed', () => {
    const service = started();
    const [choices, players, drafted] = [service.choices(), service.players(), service.drafted()];
    tick();
    poll().flush(readServerResponse('table-draft-status.xml'));
    expect(service.choices()).toBe(choices);
    expect(service.players()).toBe(players);
    expect(service.drafted()).toBe(drafted);
    service.stop();
  });

  it('declares a card: the answer marks it and the page waits for the others', async () => {
    const service = started();
    const declared = service.pick(service.choices()[0]);
    expect(service.picking()).toBe(true);
    tick();
    backend.expectNone((req) => req.method === 'GET');
    const req = pickCall();
    expect((req.request.body as { get(key: string): string | null }).get('choiceId')).toBe('1_2');
    req.flush(readServerResponse('table-draft-chosen.xml'));
    await declared;
    expect(service.picking()).toBe(false);
    expect(service.phase()).toBe('waiting');
    expect(service.message()).toBe('Waiting for others to pick a card - Pack 1/3 (0:58)');
    expect(service.choices().map((choice) => choice.chosen)).toEqual([true, false, true]);
    tick();
    poll().flush(readServerResponse('table-draft-chosen.xml'));
    service.stop();
  });

  it('lets the player declare another card while waiting, but not the declared one again', async () => {
    const service = started('table-draft-chosen.xml');
    await service.pick(service.choices()[2]);
    backend.expectNone((req) => req.method === 'POST');
    const declared = service.pick(service.choices()[1]);
    pickCall().flush(readServerResponse('table-draft-chosen.xml'));
    await declared;
    service.stop();
  });

  it('drops the poll under way when a card is declared, so the older status does not show', async () => {
    const service = started();
    tick();
    const pending = poll();
    const declared = service.pick(service.choices()[0]);
    expect(pending.cancelled).toBe(true);
    pickCall().flush(readServerResponse('table-draft-chosen.xml'));
    await declared;
    expect(service.phase()).toBe('waiting');
    service.stop();
  });

  it('ignores a card not on offer, and a second declaration while one is under way', async () => {
    const service = started();
    await service.pick({ id: 'other', blueprintId: 'other', url: null });
    backend.expectNone((req) => req.method === 'POST');
    const declared = service.pick(service.choices()[0]);
    await service.pick(service.choices()[1]);
    pickCall().flush(readServerResponse('table-draft-chosen.xml'));
    await declared;
    service.stop();
  });

  it('adds the one newly drafted card at the end when the next pack comes, and passes the other way', () => {
    const service = started();
    tick();
    poll().flush(readServerResponse('table-draft-next-pick.xml'));
    expect(service.draftedCopies()).toEqual(['1_1', '1_13', '1_13', '1_2']);
    expect(service.choices().map((choice) => choice.id)).toEqual(['1_7', '1_12']);
    expect(service.passSeparator()).toBe(' < ');
    expect(service.secondsRemaining()).toBeNull();
    expect(service.message()).toBe('Make a pick - Pack 2/3');
    service.stop();
  });

  it('takes the server pool when the first answer comes, whatever was shown', () => {
    const service = started('table-draft-next-pick.xml');
    expect(service.draftedCopies()).toEqual(['1_1', '1_2', '1_13', '1_13']);
    service.stop();
  });

  it('says the draft is finished and stops polling', () => {
    const service = started();
    tick();
    poll().flush(readServerResponse('table-draft-finished.xml'));
    expect(service.phase()).toBe('finished');
    expect(service.message()).toBe(DRAFT_FINISHED);
    expect(service.running).toBe(false);
    expect(service.draftedCopies()).toEqual(['1_1', '1_2', '1_2', '1_13', '1_13', '1_30']);
    tick();
    backend.expectNone(DRAFT);
  });

  it('ignores an answer that is not a draft status, and goes on polling', () => {
    const service = started();
    tick();
    poll().flush('<other/>');
    expect(service.phase()).toBe('picking');
    tick();
    poll().flush(readServerResponse('table-draft-status.xml'));
    service.stop();
  });

  it('stops polling and gives the legacy warnings when a poll fails; start() tries again', () => {
    const service = create();
    service.start();
    poll().flush('', { status: 404, statusText: 'Not Found' });
    expect(service.phase()).toBe('lost');
    expect(service.message()).toBeNull();
    expect(service.notices()).toEqual(CONNECTION_LOST);
    expect(service.running).toBe(false);
    expect(notifier.dialogs).toEqual([]);
    service.refresh();
    tick();
    backend.expectNone(DRAFT);

    service.start();
    expect(service.phase()).toBe('loading');
    poll().flush(readServerResponse('table-draft-status.xml'));
    expect(service.phase()).toBe('picking');
    service.stop();
  });

  it('alerts when the card is no longer on offer (400) and goes on polling', async () => {
    const service = started();
    const declared = service.pick(service.choices()[1]);
    pickCall().flush('', { status: 400, statusText: 'Bad Request' });
    await declared;
    expect(notifier.dialogs).toEqual([`alert: ${GENERIC_COMMUNICATION_ERROR}`]);
    expect(service.picking()).toBe(false);
    poll().flush(readServerResponse('table-draft-next-pick.xml'));
    expect(service.running).toBe(true);
    expect(service.phase()).toBe('picking');
    service.stop();
  });

  it('handles any other failed declaration as a lost connection', async () => {
    const service = started();
    const declared = service.pick(service.choices()[0]);
    pickCall().flush('', { status: 404, statusText: 'Not Found' });
    await declared;
    await settle();
    expect(service.phase()).toBe('lost');
    expect(service.picking()).toBe(false);
    expect(service.running).toBe(false);
  });

  it('drops a declaration answered after stop()', async () => {
    const service = started();
    const declared = service.pick(service.choices()[0]);
    service.stop();
    expect(service.picking()).toBe(false);
    pickCall().flush(readServerResponse('table-draft-chosen.xml'));
    await declared;
    expect(service.phase()).toBe('picking');
  });

  it('stops polling when its injector is destroyed (the route is left)', () => {
    const service = started();
    tick();
    const pending = poll();
    TestBed.resetTestingModule();
    expect(pending.cancelled).toBe(true);
    expect(service.running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
