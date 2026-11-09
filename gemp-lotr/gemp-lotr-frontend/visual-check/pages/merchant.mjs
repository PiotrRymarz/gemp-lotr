// The merchant: the legacy merchant.html and the Angular page at /gemp-lotr/ng/merchant. GET /merchant is answered
// with pages of a stubbed offer list (packs, cards the player owns, foils, a site); the operations answer OK.
import { settle } from '../lib/steps.mjs';

/** The merchant's stock: a pack, then set 1's first cards with owned counts and prices, a foil and a site. */
const ITEMS = [
  { pack: 'FotR - Booster', count: 0, sell: 300 },
  ...Array.from({ length: 40 }, (_, i) => {
    const owned = i % 6;
    return {
      id: `1_${i + 1}${i === 7 ? '*' : ''}`,
      count: owned,
      buy: owned > 0 ? 10 + i * 7 : null,
      sell: i === 7 ? null : 25 + i * 53,
      tradeFoil: owned >= 4 && i !== 7,
    };
  }),
  { id: '1_319', count: 2, buy: 5, sell: 40 },
];
const CURRENCY = 1234;

function merchantXml(url) {
  const filter = url.searchParams.get('filter') ?? '';
  const ownedMin = Number(url.searchParams.get('ownedMin') ?? 0);
  const start = Number(url.searchParams.get('start') ?? 0);
  const count = Number(url.searchParams.get('count') ?? 18);
  // A name filter keeps a few items, so "filtered" shows a short page
  const matching = ITEMS.filter((item) => item.count >= ownedMin).filter(
    (item, i) => !filter.includes('name:') || i % 7 === 1,
  );
  const attrs = (item) =>
    `blueprintId="${item.pack ?? item.id}" count="${item.count}"` +
    (item.buy != null ? ` buyPrice="${item.buy}"` : '') +
    (item.sell != null ? ` sellPrice="${item.sell}"` : '') +
    (item.tradeFoil ? ' tradeFoil="true"' : '');
  const items = matching
    .slice(start, start + count)
    .map((item) => `<${item.pack ? 'pack' : 'card'} ${attrs(item)}/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><merchant count="${matching.length}" currency="${CURRENCY}">${items}</merchant>`;
}

const LEGACY = {
  name: '#filter-inputs input[type=text]',
  nextPage: '#nextPage',
  sell: '.buyPrice',
  buy: '.sellPrice',
};
const ANGULAR = {
  name: '.gd-merchant-filter [data-field="name"] input',
  nextPage: '.gd-pager__next',
  sell: '.gd-offer [data-action="sell"]',
  buy: '.gd-offer [data-action="buy"]',
};
const controls = (which) => (which === 'legacy' ? LEGACY : ANGULAR);

export default {
  name: 'merchant',
  legacy: '/gemp-lotr/merchant.html',
  angular: '/gemp-lotr/ng/merchant',
  answer(path, url) {
    if (path === '/player') return { file: 'player.json', type: 'application/json' };
    if (path === '/merchant') return { xml: merchantXml(url) };
    if (path.startsWith('/merchant/')) return { file: 'merchant-ok.txt', type: 'text/html' };
    return null;
  },
  scenarios: [
    { name: 'initial', act: async () => {} },
    {
      name: 'filtered',
      act: async (page, which) => {
        await page.fill(controls(which).name, 'gandalf');
        await page.press(controls(which).name, 'Enter');
        await page.mouse.move(0, 0);
      },
    },
    {
      name: 'page-2',
      act: async (page, which) => {
        await page.click(controls(which).nextPage);
        // Once the page is there: the legacy button, disabled meanwhile, would keep its hover look
        await settle(page);
        await page.mouse.move(0, 0);
      },
    },
    {
      name: 'confirm',
      act: async (page, which) => {
        await page.locator(controls(which).sell).first().click();
      },
    },
    {
      // Where the theme folds the filter's details away (modern, phones): the toggle shows them
      name: 'filters-open',
      angularOnly: true,
      skip: (mode) =>
        (mode.theme !== 'modern' || mode.width >= 768) && 'the filter folds away on phones in modern only',
      act: async (page) => {
        await page.click('.gd-merchant-filter__toggle');
        await page.mouse.move(0, 0);
      },
    },
    {
      name: 'error',
      answers: { '/merchant': { status: 500 } },
      act: async () => {},
    },
  ],
};
