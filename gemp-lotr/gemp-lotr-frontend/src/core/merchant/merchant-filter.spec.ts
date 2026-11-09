import { readLegacyWebFile } from '../../testing/files';
import {
  buildMerchantFilter,
  dynamicFilters,
  hobbitCulturesShown,
  INITIAL_MERCHANT_FILTER,
  MERCHANT_CARD_TYPE_OPTIONS,
  MERCHANT_CULTURES,
  MERCHANT_HOBBIT_CULTURES,
  MERCHANT_ITEM_CLASS_OPTIONS,
  MERCHANT_KEYWORD_OPTIONS,
  MERCHANT_PHASE_OPTIONS,
  MERCHANT_PRODUCT_OPTIONS,
  MERCHANT_RACE_OPTIONS,
  MERCHANT_RARITY_OPTIONS,
  MERCHANT_SET_OPTIONS,
  MERCHANT_SORT_OPTIONS,
  MerchantSelectOption,
  normalizeMerchantFilter,
} from './merchant-filter';

const LEGACY = readLegacyWebFile('js/gemp-022/cardFilter.js');

/** The options of a legacy select, by the start of its markup (e.g. "<select id='cardType'"), as [value, label]. */
function legacyOptions(selectStart: string): [string, string][] {
  const from = LEGACY.indexOf(selectStart);
  expect(from).toBeGreaterThan(-1);
  const markup = LEGACY.slice(from, LEGACY.indexOf('</select>', from));
  return [...markup.matchAll(/^\s*\+ "<option( value='([^']*)')?( disabled)?>([^<]*)<\/option>"/gm)].map((m) => [
    m[2] ?? m[4],
    m[4],
  ]);
}

const pairs = (options: readonly MerchantSelectOption[]): [string, string][] => options.map((o) => [o.value, o.label]);

describe('merchant filter', () => {
  it.each([
    ["<select id='setSelect'", MERCHANT_SET_OPTIONS],
    ["<select style='width: 80px", MERCHANT_SORT_OPTIONS],
    ["<select style='width: 40px", MERCHANT_RARITY_OPTIONS],
    ["<select id='cardType'", MERCHANT_CARD_TYPE_OPTIONS],
    ["<select id='keyword'", MERCHANT_KEYWORD_OPTIONS],
    ["<select id='type'", MERCHANT_PRODUCT_OPTIONS],
    ["<select id ='race'", MERCHANT_RACE_OPTIONS],
    ["<select id ='itemClass'", MERCHANT_ITEM_CLASS_OPTIONS],
    ["<select id ='phase'", MERCHANT_PHASE_OPTIONS],
  ])('has the legacy options of %s', (select, options) => {
    expect(pairs(options)).toEqual(legacyOptions(select));
  });

  it('has the legacy culture buttons, in order', () => {
    const ids = [...LEGACY.matchAll(/<input type='checkbox' id='(\w+)'\/>/g)].map((m) => m[1]);
    expect([...MERCHANT_CULTURES, ...MERCHANT_HOBBIT_CULTURES]).toEqual(ids);
  });

  it('starts with all sets and cards only', () => {
    expect(buildMerchantFilter(INITIAL_MERCHANT_FILTER)).toBe('product:card set:0-34,50-200,404');
  });

  it('builds the legacy filter string, spaces included', () => {
    const filter = buildMerchantFilter({
      ...INITIAL_MERCHANT_FILTER,
      cardType: 'COMPANION,ALLY,MINION',
      cultures: ['SHIRE', 'DWARVEN'],
      keyword: 'RANGER',
      race: 'HOBBIT',
      set: '1',
      sort: 'twilight,name',
      name: 'Sam  Gamgee',
      rarity: 'C,U,P,S',
    });
    expect(filter).toBe(
      'cardType:COMPANION,ALLY,MINION  culture:DWARVEN,SHIRE keyword:RANGER product:card race:HOBBIT set:1' +
        ' sort:twilight,name name:Sam name: name:Gamgee rarity:C,U,P,S',
    );
  });

  it('leaves out empty fields, and trims', () => {
    expect(buildMerchantFilter({ ...INITIAL_MERCHANT_FILTER, product: '', set: '' })).toBe('');
    expect(buildMerchantFilter({ ...INITIAL_MERCHANT_FILTER, product: '', phase: 'SKIRMISH', set: '' })).toBe(
      'phase:SKIRMISH',
    );
  });

  it('shows race, item class or phase by card type', () => {
    expect(dynamicFilters('')).toEqual({ race: false, itemClass: false, phase: false });
    expect(dynamicFilters('COMPANION,ALLY,MINION')).toEqual({ race: true, itemClass: false, phase: false });
    expect(dynamicFilters('MINION')).toEqual({ race: true, itemClass: false, phase: false });
    expect(dynamicFilters('POSSESSION,ARTIFACT')).toEqual({ race: false, itemClass: true, phase: false });
    expect(dynamicFilters('EVENT')).toEqual({ race: false, itemClass: false, phase: true });
    expect(dynamicFilters('SITE')).toEqual({ race: false, itemClass: false, phase: false });
  });

  it('shows the Hobbit cultures for the Hobbit sets only', () => {
    expect(['30-33', '30', '31', '32', '33'].every(hobbitCulturesShown)).toBe(true);
    const others = MERCHANT_SET_OPTIONS.map((o) => o.value).filter((v) => !/^3[0-3]/.test(v));
    expect(others.filter(hobbitCulturesShown)).toEqual([]);
  });

  it('clears hidden fields and Hobbit cultures', () => {
    const fields = normalizeMerchantFilter({
      ...INITIAL_MERCHANT_FILTER,
      cardType: 'EVENT',
      race: 'ELF',
      itemClass: 'RING',
      phase: 'SKIRMISH',
      cultures: ['ELVEN', 'SMAUG'],
    });
    expect(fields).toMatchObject({ race: '', itemClass: '', phase: 'SKIRMISH', cultures: ['ELVEN'] });
    expect(normalizeMerchantFilter({ ...fields, set: '31', cultures: ['SMAUG'] }).cultures).toEqual(['SMAUG']);
  });
});
