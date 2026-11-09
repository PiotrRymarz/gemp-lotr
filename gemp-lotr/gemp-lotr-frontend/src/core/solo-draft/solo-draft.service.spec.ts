import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { readServerResponse } from '../../testing/files';
import { FakeNotifier, provideFakeNotifier, settle } from '../../testing/fake-notifier';
import { GENERIC_COMMUNICATION_ERROR } from '../api/api-error';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { DRAFT_FINISHED, MAKE_A_PICK, NO_DRAFT_EVENT } from './solo-draft-messages';
import { SOLO_DRAFT_SERVICES } from './solo-draft-services';
import { SoloDraftService } from './solo-draft.service';

const DRAFT = '/gemp-lotr-server/soloDraft/20261101';
const COLLECTION = '/gemp-lotr-server/collection/20261101';

describe('SoloDraftService', () => {
  let backend: HttpTestingController;
  let notifier: FakeNotifier;

  function create(queryString = '?eventId=20261101'): SoloDraftService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeNotifier(),
        ...SOLO_DRAFT_SERVICES,
        { provide: PAGE_QUERY_STRING, useValue: queryString },
      ],
    });
    notifier = TestBed.inject(FakeNotifier);
    backend = TestBed.inject(HttpTestingController);
    return TestBed.inject(SoloDraftService);
  }

  afterEach(() => backend.verify());

  const draftCall = (method: string): TestRequest =>
    backend.expectOne((req) => req.url === DRAFT && req.method === method);
  const collectionCall = (): TestRequest => backend.expectOne((req) => req.url === COLLECTION);

  /** Loads the draft, answering both calls. */
  async function load(service: SoloDraftService, picks = 'solo-draft-picks.xml'): Promise<void> {
    const loaded = service.load();
    draftCall('GET').flush(readServerResponse(picks));
    collectionCall().flush(readServerResponse('solo-draft-collection.xml'));
    await loaded;
  }

  it('reads the event from ?eventId= and shows nothing before loading', () => {
    const service = create('?participantId=bob&eventId=20261101');
    expect(service.eventId).toBe('20261101');
    expect(service.status()).toBe('loading');
    expect(service.message()).toBeNull();
    expect(service.choices()).toEqual([]);
    expect(service.drafted()).toEqual([]);
  });

  it('asks nothing without ?eventId=, and says so', async () => {
    const service = create('');
    expect(service.eventId).toBeNull();
    await service.load();
    await service.pick({ id: '1_2', blueprintId: '1_2', url: null });
    expect(service.status()).toBe('noEvent');
    expect(service.message()).toBe(NO_DRAFT_EVENT);
    expect(notifier.dialogs).toEqual([]);
  });

  it('loads the picks on offer and the drafted cards', async () => {
    const service = create();
    await load(service);
    expect(service.status()).toBe('picking');
    expect(service.message()).toBe(MAKE_A_PICK);
    expect(service.choices().map((choice) => choice.id)).toEqual(['1_2', '1_45*', '1_319']);
    expect(service.draftedCopies()).toEqual(['1_1', '1_13', '1_13', '1_178']);
    expect(service.draftedCount()).toBe(4);
  });

  it('says the draft is finished when nothing is on offer', async () => {
    const service = create();
    await load(service, 'solo-draft-finished.xml');
    expect(service.status()).toBe('finished');
    expect(service.message()).toBe(DRAFT_FINISHED);
    expect(service.draftedCount()).toBe(4);
  });

  it('alerts once when loading fails', async () => {
    const service = create();
    const loaded = service.load();
    const collection = collectionCall();
    draftCall('GET').flush('', { status: 404, statusText: 'Not Found' });
    expect(collection.cancelled).toBe(true);
    await loaded;
    expect(service.status()).toBe('failed');
    expect(service.message()).toBeNull();
    expect(notifier.dialogs).toEqual([`alert: ${GENERIC_COMMUNICATION_ERROR}`]);
  });

  it('makes a pick: the picks go at once, then the picked card follows the drafted ones and the next picks show', async () => {
    const service = create();
    await load(service);
    const picked = service.pick(service.choices()[0]);
    expect(service.choices()).toEqual([]);
    expect(service.picking()).toBe(true);
    const req = draftCall('POST');
    expect((req.request.body as { get(key: string): string | null }).get('choiceId')).toBe('1_2');
    req.flush(readServerResponse('solo-draft-pick-result.xml'));
    await picked;
    expect(service.picking()).toBe(false);
    expect(service.draftedCopies()).toEqual(['1_1', '1_13', '1_13', '1_178', '1_2']);
    expect(service.choices().map((choice) => choice.id)).toEqual(['1_7', '1_12']);
    expect(service.message()).toBe(MAKE_A_PICK);
  });

  it('finishes the draft after the last pick', async () => {
    const service = create();
    await load(service);
    const picked = service.pick(service.choices()[2]);
    draftCall('POST').flush(readServerResponse('solo-draft-last-pick-result.xml'));
    await picked;
    expect(service.status()).toBe('finished');
    expect(service.message()).toBe(DRAFT_FINISHED);
    expect(service.draftedCopies().slice(4)).toEqual(['1_30', '1_30', '1_31']);
  });

  it('ignores a choice not on offer, and a second pick while one is under way', async () => {
    const service = create();
    await load(service);
    await service.pick({ id: 'other', blueprintId: 'other', url: null });
    backend.expectNone((req) => req.method === 'POST');
    const first = service.choices()[0];
    const second = service.choices()[1];
    const picked = service.pick(first);
    await service.pick(second);
    const [req] = backend.match((r) => r.method === 'POST');
    req.flush(readServerResponse('solo-draft-pick-result.xml'));
    await picked;
    expect(service.draftedCount()).toBe(5);
  });

  it('picks a pick shown by a picture by its id', async () => {
    const service = create();
    await load(service, 'solo-draft-picture-picks.xml');
    const picked = service.pick(service.choices()[1]);
    const req = draftCall('POST');
    expect((req.request.body as { get(key: string): string | null }).get('choiceId')).toBe('fp-dwarven');
    req.flush(readServerResponse('solo-draft-last-pick-result.xml'));
    await picked;
    expect(service.status()).toBe('finished');
  });

  it('alerts when a pick fails, then loads the draft again', async () => {
    const service = create();
    await load(service);
    const picked = service.pick(service.choices()[0]);
    draftCall('POST').flush('', { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(notifier.dialogs).toEqual([`alert: ${GENERIC_COMMUNICATION_ERROR}`]);
    draftCall('GET').flush(readServerResponse('solo-draft-picks.xml'));
    collectionCall().flush(readServerResponse('solo-draft-collection.xml'));
    await picked;
    expect(service.picking()).toBe(false);
    expect(service.status()).toBe('picking');
    expect(service.choices()).toHaveLength(3);
    expect(service.draftedCount()).toBe(4);
  });

  it('shows only the newest load', async () => {
    const service = create();
    const older = service.load();
    const newer = service.load();
    const [oldDraft, newDraft] = backend.match((req) => req.url === DRAFT);
    const [oldCollection, newCollection] = backend.match((req) => req.url === COLLECTION);
    newDraft.flush(readServerResponse('solo-draft-finished.xml'));
    newCollection.flush(readServerResponse('solo-draft-collection.xml'));
    await newer;
    oldDraft.flush(readServerResponse('solo-draft-picks.xml'));
    oldCollection.flush(readServerResponse('solo-draft-collection.xml'));
    await older;
    expect(service.status()).toBe('finished');
  });
});
