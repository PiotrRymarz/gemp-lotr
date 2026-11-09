import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CardInfoService } from '../../core/cards/card-info.service';
import { parseMerchantPage } from '../../core/merchant/merchant-parsers';
import { MERCHANT_SERVICES } from '../../core/merchant/merchant-services';
import { MerchantService } from '../../core/merchant/merchant.service';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { readServerResponse } from '../../testing/files';
import { FakeNotifier, provideFakeNotifier, settle } from '../../testing/fake-notifier';
import { MerchantGridComponent } from './merchant-grid.component';

const PAGE = parseMerchantPage(new DOMParser().parseFromString(readServerResponse('merchant.xml'), 'application/xml'));

describe('MerchantGridComponent', () => {
  let merchant: MerchantService;

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
    merchant = TestBed.inject(MerchantService);
  });

  afterEach(() => TestBed.inject(HttpTestingController).match(() => true));

  async function render() {
    const fixture = TestBed.createComponent(MerchantGridComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const offers = () => Array.from(el.querySelectorAll<HTMLElement>('.gd-offer'));
    const offer = (blueprintId: string) =>
      offers().find((o) => o.querySelector('.gd-card')!.getAttribute('aria-label')!.startsWith(`${blueprintId} `))!;
    const actions = (o: HTMLElement) =>
      Array.from(o.querySelectorAll<HTMLButtonElement>('.gd-offer__action')).map((b) => b.dataset['action']);
    return { fixture, el, offers, offer, actions };
  }

  it('shows nothing before the first page has loaded', async () => {
    const { el } = await render();
    expect(el.classList).toContain('gd-merchant-grid');
    expect(el.querySelectorAll('.gd-offer').length).toBe(0);
  });

  it('shows packs first, each offer with the copies owned and its buttons with their prices', async () => {
    merchant.page.set(PAGE);
    const { el, offers, offer, actions } = await render();
    expect(el.querySelector<HTMLElement>('.gd-merchant-grid__cards')!.dataset['count']).toBe('5');
    expect(offers().map((o) => o.dataset['kind'])).toEqual(['pack', 'card', 'card', 'card', 'card']);
    expect(offers().map((o) => o.dataset['owned'])).toEqual(['0', '5', '1', '0', '2']);
    expect(offers().map((o) => o.querySelector('.gd-card__count')!.textContent)).toEqual(['0', '5', '1', '0', '2']);
    expect(offer('1_319').dataset['orientation']).toBe('horizontal');

    expect(actions(offer('1_1'))).toEqual(['sell', 'buy', 'trade-foil']);
    expect(actions(offer('FotR - Booster'))).toEqual(['buy']);
    expect(actions(offer('1_2*'))).toEqual(['sell']);
    const sell = offer('1_1').querySelector<HTMLButtonElement>('[data-action="sell"]')!;
    expect(sell.querySelector('.gd-offer__label')!.textContent).toBe('Sell for');
    expect(sell.querySelector('.gd-price')!.getAttribute('aria-label')).toBe('1 gold 50 silver');
    expect(offer('1_1').querySelector('[data-action="trade-foil"]')!.textContent!.trim()).toBe('Trade 4 for foil');
  });

  it('disables "Buy for" when it costs more than the currency', async () => {
    merchant.page.set(PAGE);
    const { offer } = await render();
    const tooDear = offer('1_3').querySelector<HTMLButtonElement>('[data-action="buy"]')!;
    expect(tooDear.disabled).toBe(true);
    expect(tooDear.hasAttribute('data-unaffordable')).toBe(true);
    const justEnough = offer('1_319').querySelector<HTMLButtonElement>('[data-action="buy"]')!;
    expect(justEnough.disabled).toBe(false);
    expect(justEnough.hasAttribute('data-unaffordable')).toBe(false);
  });

  it('hides the buttons with "Hide merchant"', async () => {
    merchant.page.set(PAGE);
    merchant.hideMerchant.set(true);
    const { el } = await render();
    expect(el.querySelectorAll('.gd-offer').length).toBe(5);
    expect(el.querySelectorAll('.gd-offer__action').length).toBe(0);
  });

  it('asks before selling, buying or trading for a foil', async () => {
    merchant.page.set(PAGE);
    const notifier = TestBed.inject(FakeNotifier);
    const { offer } = await render();
    offer('1_1').querySelector<HTMLButtonElement>('[data-action="sell"]')!.click();
    await settle();
    offer('FotR - Booster').querySelector<HTMLButtonElement>('[data-action="buy"]')!.click();
    await settle();
    offer('1_1').querySelector<HTMLButtonElement>('[data-action="trade-foil"]')!.click();
    await settle();
    expect(notifier.dialogs).toEqual([
      'confirm: Do you want to sell this item for 1G 50S?',
      'confirm: Do you want to buy this item for 3G 00S?',
      'confirm: Do you want to trade 4 of this card and 4G in currency for a foil version of the card?',
    ]);
  });

  it("shows a card's information on right-click or shift-click; a plain click does nothing", async () => {
    merchant.page.set(PAGE);
    const info = TestBed.inject(CardInfoService);
    const { offer } = await render();
    const card = offer('1_3').querySelector<HTMLButtonElement>('.gd-card')!;
    card.click();
    expect(info.card()).toBeNull();
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(info.card()).toEqual(expect.objectContaining({ kind: 'merchant', blueprintId: '1_3' }));
    info.close();
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(info.card()).toEqual(expect.objectContaining({ kind: 'merchant', blueprintId: '1_3' }));
  });
});
