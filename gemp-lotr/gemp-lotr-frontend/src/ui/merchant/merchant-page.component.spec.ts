import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { GENERIC_COMMUNICATION_ERROR } from '../../core/api/api-error';
import { MERCHANT_SERVICES } from '../../core/merchant/merchant-services';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { readServerResponse } from '../../testing/files';
import { FakeNotifier, provideFakeNotifier, settle } from '../../testing/fake-notifier';
import { MERCHANT_VIEW_PROVIDERS } from './merchant-notifier';
import { MerchantPageComponent } from './merchant-page.component';

const MERCHANT_XML = readServerResponse('merchant.xml');

describe('MerchantPageComponent', () => {
  let backend: HttpTestingController;
  let el: HTMLElement;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        // As app.routes.ts provides the page
        provideRouter([
          { path: '', component: MerchantPageComponent, providers: [...MERCHANT_SERVICES, ...MERCHANT_VIEW_PROVIDERS] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeNotifier(),
        { provide: PAGE_QUERY_STRING, useValue: '' },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    el = harness.routeNativeElement!;
  });

  afterEach(() => backend.match(() => true));

  const offers = (): TestRequest[] => backend.match((req) => req.url === '/gemp-lotr-server/merchant');

  async function loaded(): Promise<void> {
    offers().at(-1)!.flush(MERCHANT_XML);
    await settle();
    await harness.fixture.whenStable();
  }

  const dialog = () => el.querySelector<HTMLDialogElement>('dialog.gd-dialog[data-dialog="merchant-question"]')!;

  it('loads the first page, then shows the filter and the offers', async () => {
    expect(el.classList).toContain('gd-merchant');
    expect(el.dataset['state']).toBe('loading');
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('section.gd-merchant__filter gd-merchant-filter')).not.toBeNull();
    expect(el.querySelector('section.gd-merchant__offers gd-merchant-grid')).not.toBeNull();
    expect(el.querySelector('gd-card-info')).not.toBeNull();
    await loaded();
    expect(el.dataset['state']).toBe('ready');
    expect(el.querySelectorAll('.gd-offer').length).toBe(5);
  });

  it('asks in the "Merchant operation" dialog, beside the item, and sells on Yes', async () => {
    await loaded();
    el.querySelector<HTMLButtonElement>('.gd-offer:nth-child(2) [data-action="sell"]')!.click();
    await harness.fixture.whenStable();
    expect(el.hasAttribute('data-busy')).toBe(true);
    expect(dialog().open).toBe(true);
    expect(dialog().querySelector('.gd-dialog__title')!.textContent).toBe('Merchant operation');
    const card = dialog().querySelector<HTMLElement>('.gd-merchant-question__card')!;
    expect(card.dataset['orientation']).toBe('vertical');
    expect(card.querySelector('img')!.getAttribute('src')).toBe('https://i.lotrtcgpc.net/decipher/LOTR01001.jpg');
    expect(dialog().querySelector('.gd-merchant-question__wiki')).not.toBeNull();
    const message = dialog().querySelector('.gd-merchant-question__message')!;
    expect(message.textContent!.replace(/\s+/g, ' ').trim()).toBe('Do you want to sell this item for 1 50?');
    expect(message.querySelector('.gd-price')!.getAttribute('aria-label')).toBe('1 gold 50 silver');

    dialog().querySelector<HTMLButtonElement>('[data-action="yes"]')!.click();
    await settle();
    const sell = backend.expectOne('/gemp-lotr-server/merchant/sell');
    expect(sell.request.body.get('blueprintId')).toBe('1_1');
    expect(sell.request.body.get('price')).toBe('150');
    sell.flush('OK');
    await settle();
    await harness.fixture.whenStable();
    expect(dialog().open).toBe(false);
    expect(offers().length).toBe(1);
    expect(el.hasAttribute('data-busy')).toBe(false);
  });

  it('does nothing on No; the foil trade asks its question in words', async () => {
    await loaded();
    el.querySelector<HTMLButtonElement>('[data-action="trade-foil"]')!.click();
    await harness.fixture.whenStable();
    expect(dialog().querySelector('.gd-merchant-question__message')!.textContent!.trim()).toBe(
      'Do you want to trade 4 of this card and 4G in currency for a foil version of the card?',
    );
    dialog().querySelector<HTMLButtonElement>('[data-action="no"]')!.click();
    await settle();
    await harness.fixture.whenStable();
    expect(dialog().open).toBe(false);
    expect(backend.match((req) => req.url.startsWith('/gemp-lotr-server/merchant/')).length).toBe(0);
  });

  it("tells the player through the app's Notifier when the page can't be loaded", async () => {
    offers()[0].flush('', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(TestBed.inject(FakeNotifier).dialogs).toEqual([`alert: ${GENERIC_COMMUNICATION_ERROR}`]);
    expect(el.dataset['state']).toBe('loading');
  });
});
