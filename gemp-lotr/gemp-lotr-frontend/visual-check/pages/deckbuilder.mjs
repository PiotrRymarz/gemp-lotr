// The deck builder: the legacy deckBuild.html and the Angular page at /gemp-lotr/ng/deckbuilder/. Its scenarios use
// the selectors in controls.mjs (shared with run.mjs).
import { CONTROLS } from '../controls.mjs';
import { hover, openMenu, settle, showPane } from '../lib/steps.mjs';

const FORMATS = {
  Formats: Object.fromEntries(
    [
      ['rev_tow_sta', 'Anything Goes'],
      ['fotr_block', 'Fellowship Block'],
      ['pc_movie', 'Movie Block (PC)'],
    ].map(([code, name], order) => [
      code,
      {
        code,
        name,
        order,
        hall: true,
        usesMaps: false,
        blockFilters: [
          { filter: 'fotr_block', name: 'Fellowship Block', setFilters: { 'The Fellowship of the Ring': '1' } },
        ],
        errata: {},
      },
    ]),
  ),
};

/** A collection of the first cards of set 1, a few of its sites (landscape cards) and two packs. */
const COLLECTION = [
  { pack: 'FotR - Booster', count: 2 },
  { pack: '(S)FotR - Starter', count: 2, contents: '1_1|1_2|1_3|1_4|1_319' },
  ...Array.from({ length: 60 }, (_, i) => ({
    id: `1_${i + 1}`,
    count: (i % 4) + 1,
    side: i % 3 === 0 ? 'SHADOW' : 'FREE_PEOPLE',
  })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: `1_${319 + i}`, count: 1, side: null })),
];

function collectionXml(url) {
  const start = Number(url.searchParams.get('start') ?? 0);
  const count = Number(url.searchParams.get('count') ?? 18);
  const items = COLLECTION.slice(start, start + count)
    .map((item) =>
      item.pack
        ? `<pack blueprintId="${item.pack}" count="${item.count}"${item.contents ? ` contents="${item.contents}"` : ''}/>`
        : `<card blueprintId="${item.id}" count="${item.count}"${item.side ? ` side="${item.side}"` : ''}/>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><collection count="${COLLECTION.length}">${items}</collection>`;
}

/** A few saved decks (and library decks), with a name to escape and a long one. */
const DECKS = [
  ['Fellowship Block', 'Test + deck &amp; co'],
  ['Anything Goes', 'Aragorn and the Rangers'],
  ['Movie Block (PC)', 'Gandalf the Grey, Gandalf the White and the Fellowship of the Ring on their way to Mordor'],
  ['Fellowship Block', 'Moria Orcs'],
];
const DECKS_XML = `<?xml version="1.0" encoding="UTF-8"?><decks>${DECKS.map(
  ([format, name]) => `<deck targetFormat="${format}">${name}</deck>`,
).join('')}</decks>`;

function answer(p, url) {
  if (p === '/player') return { file: 'player.json', type: 'application/json' };
  if (p === '/deck/formats') return { json: FORMATS };
  if (p === '/deck/list' || p === '/deck/libraryList') return { xml: DECKS_XML };
  if (p === '/deck/stats') return { file: 'stats.html', type: 'text/html' };
  if (p === '/collection') return { file: 'collection-types.xml' };
  if (p.startsWith('/collection/')) return { xml: collectionXml(url) };
  if (p === '/league') return { file: 'leagues.xml' };
  if (p === '/delivery/packContents') return { status: 404 };
  return null;
}

/** Shows the collection pane (the tab bar's, where the theme shows one pane at a time). */
const collection = (page, which) => showPane(page, which, 'collection');

/**
 * A few cards in the deck: Free Peoples and Shadow cards from the first page (one of them three times, so copies show
 * behind it) and three sites from the last page (12 items a page). Ends on the deck pane.
 */
async function addDeck(page, which) {
  const tabs = await collection(page, which);
  const cards = page.locator(CONTROLS.firstCard[which]);
  for (const index of [2, 3, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    await cards.nth(index).click();
    await page.waitForTimeout(50);
  }
  for (let i = 0; i < 5; i++) {
    await page.click(CONTROLS.nextPage[which]);
    await settle(page);
  }
  for (const index of [2, 3, 4]) {
    await cards.nth(index).click();
    await page.waitForTimeout(50);
  }
  if (tabs) await showPane(page, which, 'deck');
}

/** The settings button: the deck builder's toolbar's, else the shell header's (whichever the theme shows). */
async function openSettings(page) {
  for (const selector of [CONTROLS.settings.angular, '.gd-shell__header [data-action="settings"]']) {
    const button = page.locator(selector);
    if (await button.isVisible()) return button.click();
  }
  throw new Error('no visible settings button');
}

/**
 * Each scenario runs on a freshly loaded page; `act(page, which)` does the same thing on both. `angularOnly`: the
 * legacy page has no such thing and is shown as loaded.
 */
const SCENARIOS = [
  { name: 'collection', act: async () => {} },
  {
    name: 'second-page',
    act: async (page, which) => {
      await collection(page, which);
      await page.click(CONTROLS.nextPage[which]);
    },
  },
  {
    name: 'shadow-filter',
    act: async (page, which) => {
      await collection(page, which);
      await page.selectOption(CONTROLS.side[which], 'SHADOW');
    },
  },
  { name: 'deck', act: addDeck },
  {
    name: 'zoom-deck',
    act: async (page, which) => {
      await addDeck(page, which);
      await hover(page, CONTROLS.deckCard('LOTR01005')[which]);
    },
  },
  {
    name: 'zoom-collection',
    act: async (page, which) => {
      await collection(page, which);
      await hover(page, CONTROLS.collectionCard('LOTR01006')[which]);
    },
  },
  {
    name: 'card-info',
    act: async (page, which) => {
      await collection(page, which);
      await page.locator(CONTROLS.firstCard[which]).nth(2).click({ button: 'right' });
    },
  },
  /* The tab bar and the cards' ⓘ, for a theme that shows them */
  { name: 'pane-collection', angularOnly: true, act: collection },
  { name: 'pane-deck', angularOnly: true, act: addDeck },
  {
    name: 'info-button',
    angularOnly: true,
    act: async (page, which) => {
      await collection(page, which);
      await settle(page);
      const info = page.locator('.gd-collection .gd-card').nth(2).locator('.gd-card__info');
      if (await info.isVisible()) await info.click();
    },
  },
  { name: 'deck-list', act: (page, which) => page.click(CONTROLS.deckList[which]) },
  { name: 'library', act: (page, which) => page.click(CONTROLS.library[which]) },
  { name: 'import', act: (page, which) => page.click(CONTROLS.importDeck[which]) },
  {
    name: 'import-typed',
    act: async (page, which) => {
      await page.click(CONTROLS.importDeck[which]);
      await page.waitForTimeout(200);
      await page.fill(CONTROLS.importText[which], '1x Gandalf\n3x Aragorn');
      await page.mouse.move(0, 0);
    },
  },
  { name: 'notes', act: (page, which) => page.click(CONTROLS.notes[which]) },
  {
    name: 'selection',
    act: async (page, which) => {
      await collection(page, which);
      await page.locator(CONTROLS.selectionPack[which]).nth(1).click();
    },
  },
  { name: 'delivery', answers: { '/delivery/packContents': { file: 'pack-delivery.xml' } }, act: async () => {} },
  /* The settings dialog (the legacy page had none) */
  { name: 'settings', angularOnly: true, act: openSettings },
  /* The shell's menu, where the theme shows it (the legacy page had none) */
  { name: 'menu-open', angularOnly: true, act: openMenu },
  /*
   * The legacy page asked with the browser's own dialogs, which a screenshot doesn't show (Playwright answers them);
   * the legacy side shows the page behind them.
   */
  {
    name: 'confirm',
    act: async (page, which) => {
      await page.click(CONTROLS.deckList[which]);
      await page.waitForTimeout(300);
      await page.locator(CONTROLS.deleteDeck[which]).first().click();
    },
  },
  {
    name: 'prompt',
    act: async (page, which) => {
      await page.click(CONTROLS.deckList[which]);
      await page.waitForTimeout(300);
      await page.locator(CONTROLS.renameListedDeck[which]).first().click();
    },
  },
];

export default {
  name: 'deckbuilder',
  /* The deck builder came first: its screenshots keep their names without the page's (<scenario>-<size>-<side>.png) */
  prefix: '',
  legacy: '/gemp-lotr/deckBuild.html',
  angular: '/gemp-lotr/ng/deckbuilder/',
  answer,
  scenarios: SCENARIOS,
};
