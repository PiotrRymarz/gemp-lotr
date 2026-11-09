import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MERCHANT_SERVICES } from '../../core/merchant/merchant-services';
import { MerchantService } from '../../core/merchant/merchant.service';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { readServerResponse } from '../../testing/files';
import { provideFakeNotifier, settle } from '../../testing/fake-notifier';
import { MerchantFilterComponent, WIKI_CARD_SEARCH } from './merchant-filter.component';

const MERCHANT_XML = readServerResponse('merchant.xml');

describe('MerchantFilterComponent', () => {
  let merchant: MerchantService;
  let backend: HttpTestingController;

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
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.match(() => true));

  const requests = (): TestRequest[] => backend.match((req) => req.url === '/gemp-lotr-server/merchant');
  const lastParams = () => {
    const req = requests().at(-1)!;
    return Object.fromEntries(['filter', 'ownedMin', 'start', 'count'].map((p) => [p, req.request.params.get(p)]));
  };

  async function render() {
    const fixture = TestBed.createComponent(MerchantFilterComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const field = <T extends HTMLElement = HTMLSelectElement>(name: string, control = 'select') =>
      el.querySelector<T>(`.gd-merchant-field[data-field="${name}"] ${control}`)!;
    const change = async (control: HTMLInputElement | HTMLSelectElement, value: string) => {
      control.value = value;
      control.dispatchEvent(new Event(control.type === 'range' ? 'input' : 'change'));
      await fixture.whenStable();
    };
    return { fixture, el, field, change };
  }

  it('shows the legacy controls, each with an accessible name', async () => {
    const { el, field } = await render();
    expect(el.classList).toContain('gd-merchant-filter');
    const names = Array.from(el.querySelectorAll<HTMLElement>('.gd-merchant-field')).map((f) => [
      f.dataset['field'],
      f.querySelector('.gd-merchant-field__label')!.textContent,
    ]);
    expect(names).toEqual([
      ['set', 'Set'],
      ['name', 'Card name'],
      ['sort', 'Sort'],
      ['rarity', 'Rarity'],
      ['cardType', 'Card type'],
      ['keyword', 'Keyword'],
      ['product', 'Type'],
      ['race', 'Race'],
      ['itemClass', 'Item class'],
      ['phase', 'Phase'],
    ]);
    expect(field('set').value).toBe('0-34,50-200,404');
    expect(field('set').querySelectorAll('option[disabled]').length).toBe(3);
    expect(field('product').value).toBe('card');
    expect(field<HTMLInputElement>('name', 'input').placeholder).toBe('Card name');
    expect(el.querySelector<HTMLAnchorElement>('.gd-merchant-filter__wiki a')!.href).toBe(WIKI_CARD_SEARCH);
    expect(el.querySelector('.gd-merchant-filter__hide')!.textContent).toContain('Hide merchant');
    expect(el.querySelector('.gd-merchant-filter__owned')!.textContent).toContain('Owned >=');
    expect(
      Array.from(el.querySelectorAll<HTMLOptionElement>('.gd-merchant-filter__owned option')).map((o) => o.value),
    ).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('filters through MerchantService, back to the first page', async () => {
    const { field, change } = await render();
    await change(field('rarity'), 'R');
    expect(lastParams()).toEqual({
      filter: 'product:card set:0-34,50-200,404 rarity:R',
      ownedMin: '0',
      start: '0',
      count: '18',
    });
    await change(field<HTMLInputElement>('name', 'input'), 'gandalf grey');
    expect(lastParams()['filter']).toBe('product:card set:0-34,50-200,404 name:gandalf name:grey rarity:R');
  });

  it('shows race, item class or phase only for the card types that have them', async () => {
    const { field, change } = await render();
    const shown = () => ['race', 'itemClass', 'phase'].filter((f) => !field(f).closest('label')!.hidden);
    expect(shown()).toEqual([]);
    await change(field('cardType'), 'COMPANION,ALLY,MINION');
    expect(shown()).toEqual(['race']);
    await change(field('cardType'), 'POSSESSION,ARTIFACT');
    expect(shown()).toEqual(['itemClass']);
    await change(field('cardType'), 'EVENT');
    expect(shown()).toEqual(['phase']);
  });

  it('toggles cultures, showing the Hobbit ones for a Hobbit set only', async () => {
    const { el, field, change, fixture } = await render();
    const hobbit = el.querySelector<HTMLElement>('.gd-cultures__group[data-group="hobbit"]')!;
    expect(el.querySelectorAll('.gd-cultures__group[data-group="main"] .gd-culture').length).toBe(16);
    expect(hobbit.hidden).toBe(true);
    await change(field('set'), '30-33');
    expect(hobbit.hidden).toBe(false);

    const elven = el.querySelector<HTMLInputElement>('.gd-culture[data-culture="ELVEN"] input')!;
    elven.click();
    await fixture.whenStable();
    expect(lastParams()['filter']).toContain('culture:ELVEN');
    expect(el.querySelector('.gd-culture[data-culture="ELVEN"]')!.hasAttribute('data-active')).toBe(true);
    expect(el.querySelector('.gd-culture[data-culture="ELVEN"] img')!.getAttribute('src')).toBe(
      '/gemp-lotr/images/cultures/elven.png',
    );
  });

  it('pages, sizes the page, and sets "Owned >=" and "Hide merchant"', async () => {
    const { el, change, fixture } = await render();
    const previous = el.querySelector<HTMLButtonElement>('.gd-pager__previous')!;
    const next = el.querySelector<HTMLButtonElement>('.gd-pager__next')!;
    const size = el.querySelector<HTMLInputElement>('.gd-pager__track .gd-pager__size')!;
    expect([previous.disabled, next.disabled, size.disabled]).toEqual([true, true, true]);

    merchant.load();
    requests()[0].flush(MERCHANT_XML);
    await settle();
    await fixture.whenStable();
    expect([previous.disabled, next.disabled, size.disabled]).toEqual([true, false, false]);
    expect(el.querySelector('.gd-merchant-filter__pocket .gd-price')!.textContent).toBe('12 34');

    next.click();
    expect(lastParams()['start']).toBe('18');
    await change(size, '30');
    expect(lastParams()).toMatchObject({ start: '0', count: '30' });

    await change(el.querySelector<HTMLSelectElement>('.gd-merchant-filter__owned select')!, '2');
    expect(lastParams()['ownedMin']).toBe('2');

    const hide = el.querySelector<HTMLInputElement>('.gd-merchant-filter__hide input')!;
    hide.click();
    expect(merchant.hideMerchant()).toBe(true);
    expect(requests().length).toBeGreaterThan(0);
  });

  it('folds and unfolds the details with the toggle, sending nothing', async () => {
    const { el, fixture } = await render();
    const toggle = el.querySelector<HTMLButtonElement>('button.gd-merchant-filter__toggle')!;
    const details = el.querySelector<HTMLElement>('.gd-merchant-filter__details')!;
    expect(toggle.getAttribute('aria-controls')).toBe(details.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.hasAttribute('data-filters-open')).toBe(false);

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(el.hasAttribute('data-filters-open')).toBe(true);

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.hasAttribute('data-filters-open')).toBe(false);
    expect(requests().length).toBe(0);
  });
});
