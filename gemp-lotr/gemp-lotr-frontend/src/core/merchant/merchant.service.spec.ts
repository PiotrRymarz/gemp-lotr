import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { readServerResponse } from '../../testing/files';
import { FakeNotifier, provideFakeNotifier, settle } from '../../testing/fake-notifier';
import { GENERIC_COMMUNICATION_ERROR } from '../api/api-error';
import { CARD_ACTIONS } from '../cards/card-actions';
import { CardInfoService } from '../cards/card-info.service';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { MerchantCardActions } from './merchant-card-actions';
import { MerchantItem } from './merchant-models';
import { parseMerchantPage } from './merchant-parsers';
import { MERCHANT_SERVICES } from './merchant-services';
import { MERCHANT_INITIAL_PAGE_SIZE, MerchantService } from './merchant.service';

const MERCHANT_XML = readServerResponse('merchant.xml');
const ITEMS = parseMerchantPage(new DOMParser().parseFromString(MERCHANT_XML, 'application/xml')).items;
const item = (blueprintId: string): MerchantItem => ITEMS.find((i) => i.blueprintId === blueprintId)!;

describe('MerchantService', () => {
  let service: MerchantService;
  let backend: HttpTestingController;
  let notifier: FakeNotifier;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeNotifier(),
        ...MERCHANT_SERVICES,
        { provide: PAGE_QUERY_STRING, useValue: '' },
      ],
    });
    notifier = TestBed.inject(FakeNotifier);
    service = TestBed.inject(MerchantService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const offers = (): TestRequest[] => backend.match((req) => req.url === '/gemp-lotr-server/merchant');
  const params = (req: TestRequest) => ({
    filter: req.request.params.get('filter'),
    ownedMin: req.request.params.get('ownedMin'),
    start: req.request.params.get('start'),
    count: req.request.params.get('count'),
  });
  const answer = (req: TestRequest, total = 57) => req.flush(MERCHANT_XML.replace('count="57"', `count="${total}"`));

  /** Loads the first page and answers it. */
  async function loadFirstPage(total = 57): Promise<void> {
    service.load();
    const [req] = offers();
    answer(req, total);
    await settle();
  }

  it('loads cards of all sets, 18 per page, from the start', async () => {
    expect(service.page()).toBeNull();
    expect(service.sliderDisabled()).toBe(true);
    service.load();
    const [req] = offers();
    expect(params(req)).toEqual({
      filter: 'product:card set:0-34,50-200,404',
      ownedMin: '0',
      start: '0',
      count: String(MERCHANT_INITIAL_PAGE_SIZE),
    });
    answer(req);
    await settle();
    expect(service.currency()).toBe(1234);
    expect(service.page()!.items.length).toBe(5);
    expect(service.previousDisabled()).toBe(true);
    expect(service.nextDisabled()).toBe(false);
    expect(service.sliderDisabled()).toBe(false);
  });

  it('pages forwards and back, and the last page has no next', async () => {
    await loadFirstPage(40);
    service.nextPage();
    expect(service.nextDisabled()).toBe(true);
    let [req] = offers();
    expect(params(req).start).toBe('18');
    answer(req, 40);
    await settle();
    expect(service.previousDisabled()).toBe(false);
    expect(service.nextDisabled()).toBe(false);
    service.nextPage();
    [req] = offers();
    expect(params(req).start).toBe('36');
    answer(req, 40);
    await settle();
    expect(service.nextDisabled()).toBe(true);
    service.previousPage();
    [req] = offers();
    expect(params(req).start).toBe('18');
    answer(req, 40);
  });

  it('starts over on a filter change or a new page size; "Owned >=" and "Hide merchant" keep the page', async () => {
    /** The parameters of the one request made since the last call (match() takes it off the pending list). */
    const sent = () => {
      const requests = offers();
      expect(requests.length).toBe(1);
      return params(requests[0]);
    };
    await loadFirstPage();
    service.nextPage();
    answer(offers()[0]);
    service.setField('cardType', 'EVENT');
    expect(sent()).toMatchObject({ filter: 'cardType:EVENT  product:card set:0-34,50-200,404', start: '0' });
    service.nextPage();
    offers();
    service.setOwnedMin(3);
    expect(sent()).toMatchObject({ ownedMin: '3', start: '18' });
    service.setHideMerchant(true);
    expect(service.hideMerchant()).toBe(true);
    expect(sent().start).toBe('18');
    service.setName('Gandalf');
    const named = sent();
    expect(named.start).toBe('0');
    expect(named.filter).toContain(' name:Gandalf');
    service.toggleCulture('SHIRE');
    expect(sent().filter).toContain(' culture:SHIRE');
    service.toggleCulture('SHIRE');
    expect(sent().filter).not.toContain('culture');
    service.setPageSize(30);
    expect(sent()).toMatchObject({ start: '0', count: '30' });
  });

  it('clears hidden filters when the card type or set changes', () => {
    service.setField('cardType', 'COMPANION');
    service.setField('race', 'HOBBIT');
    expect(service.dynamicFilters()).toEqual({ race: true, itemClass: false, phase: false });
    service.setField('cardType', 'EVENT');
    expect(service.fields().race).toBe('');
    service.setField('set', '31');
    expect(service.hobbitCulturesShown()).toBe(true);
    service.toggleCulture('SMAUG');
    service.setField('set', '1');
    expect(service.fields().cultures).toEqual([]);
    offers();
  });

  it('shows only the newest page', async () => {
    service.load();
    service.setPageSize(10);
    const [older, newer] = offers();
    expect(older.cancelled).toBe(true);
    answer(newer, 3);
    await settle();
    expect(service.page()!.total).toBe(3);
  });

  it('tells the player when a page could not be loaded', async () => {
    service.load();
    offers()[0].flush('', { status: 500, statusText: 'Error' });
    await settle();
    expect(notifier.dialogs).toEqual([`alert: ${GENERIC_COMMUNICATION_ERROR}`]);
    expect(service.page()).toBeNull();
  });

  describe('operations', () => {
    const operation = (path: string): TestRequest[] =>
      backend.match((req) => req.url === `/gemp-lotr-server/merchant/${path}`);

    it('sells after the question, then reloads the same page', async () => {
      await loadFirstPage();
      notifier.answers.push(true);
      const done = service.sell(item('1_1'));
      expect(service.busy()).toBe(true);
      expect(service.question()).toEqual({ operation: 'sell', item: item('1_1') });
      await settle();
      expect(notifier.dialogs).toEqual(['confirm: Do you want to sell this item for 1G 50S?']);
      const [req] = operation('sell');
      expect(req.request.body.get('blueprintId')).toBe('1_1');
      expect(req.request.body.get('price')).toBe('150');
      req.flush(readServerResponse('merchant-ok.txt'));
      await done;
      expect(service.busy()).toBe(false);
      expect(service.question()).toBeNull();
      expect(params(offers()[0]).start).toBe('0');
    });

    it('buys and trades for a foil after the question', async () => {
      await loadFirstPage();
      notifier.answers.push(true, true);
      const bought = service.buy(item('1_1'));
      await settle();
      const [buy] = operation('buy');
      expect(buy.request.body.get('price')).toBe('420');
      buy.flush('OK');
      await bought;
      offers();
      const traded = service.tradeFoil(item('1_1'));
      await settle();
      const [trade] = operation('tradeFoil');
      expect(trade.request.body.get('blueprintId')).toBe('1_1');
      trade.flush('OK');
      await traded;
      offers();
      expect(notifier.dialogs).toEqual([
        'confirm: Do you want to buy this item for 4G 20S?',
        'confirm: Do you want to trade 4 of this card and 4G in currency for a foil version of the card?',
      ]);
    });

    it('does nothing when the player says no', async () => {
      await loadFirstPage();
      notifier.answers.push(false);
      await service.sell(item('1_1'));
      expect(operation('sell')).toEqual([]);
      expect(offers()).toEqual([]);
      expect(service.busy()).toBe(false);
    });

    it("doesn't offer what the item can't do or the player can't afford", async () => {
      await loadFirstPage();
      await service.sell(item('1_3'));
      await service.buy(item('1_2*'));
      await service.buy(item('1_3'));
      await service.tradeFoil(item('1_319'));
      expect(notifier.dialogs).toEqual([]);
    });

    it('asks one question at a time', async () => {
      await loadFirstPage();
      notifier.answers.push(false);
      const first = service.sell(item('1_1'));
      await service.buy(item('1_1'));
      await first;
      expect(notifier.dialogs).toEqual(['confirm: Do you want to sell this item for 1G 50S?']);
    });

    it("shows the merchant's refusal, then reloads", async () => {
      await loadFirstPage();
      notifier.answers.push(true);
      const done = service.buy(item('FotR - Booster'));
      await settle();
      operation('buy')[0].flush(readServerResponse('merchant-error.xml'));
      await done;
      expect(notifier.dialogs[1]).toBe('alert: Unable to remove required currency from your collection');
      expect(offers().length).toBe(1);
    });

    it('tells the player when the call failed, without reloading', async () => {
      await loadFirstPage();
      notifier.answers.push(true);
      const done = service.sell(item('1_1'));
      await settle();
      operation('sell')[0].flush('', { status: 0, statusText: 'Unknown Error' });
      await done;
      expect(notifier.dialogs[1]).toBe(`alert: ${GENERIC_COMMUNICATION_ERROR}`);
      expect(offers()).toEqual([]);
      expect(service.busy()).toBe(false);
    });
  });

  it('gives the shared cards MerchantCardActions: details only, using a card does nothing', () => {
    const actions = TestBed.inject(CARD_ACTIONS);
    expect(actions).toBe(TestBed.inject(MerchantCardActions));
    const ref = { kind: 'merchant' as const, blueprintId: '1_1', item: item('1_1') };
    actions.activate(ref);
    expect(TestBed.inject(CardInfoService).card()).toBeNull();
    actions.showInfo(ref);
    expect(TestBed.inject(CardInfoService).card()).toBe(ref);
  });
});
