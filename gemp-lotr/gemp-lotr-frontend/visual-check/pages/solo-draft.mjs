// The solo draft: the legacy soloDraft.html and the Angular page at /gemp-lotr/ng/draft/solo, both with
// ?eventId=VCHECK. GET /soloDraft/VCHECK offers three cards (a foil among them, and a site), GET /collection/VCHECK is
// a drafted pool of a dozen cards; a pick (POST /soloDraft/VCHECK) gives two cards and offers three more.
const EVENT = 'VCHECK';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';

const pick = (id) => `<availablePick blueprintId="${id}" id="${id}"/>`;
const picks = (ids) => `${XML}<availablePicks>${ids.map(pick).join('')}</availablePicks>`;

/** The cards drafted so far: [blueprintId, count], as the server sorts them (sort:cardType,culture,name). */
const POOL = [
  ['1_1', 1],
  ['1_13', 2],
  ['1_30', 1],
  ['1_45', 3],
  ['1_50', 1],
  ['1_89', 2],
  ['1_178', 1],
  ['1_231', 2],
  ['1_319', 1],
];
const collection = (pool) =>
  `${XML}<collection count="${pool.length}">` +
  pool.map(([id, count]) => `<card blueprintId="${id}" count="${count}" group="fp" side="FREE_PEOPLE"/>`).join('') +
  '</collection>';

const FIRST_PICKS = ['1_2', '1_45*', '1_319'];
const NEXT_PICKS = ['1_7', '1_12', '1_340'];
const PICK_RESULT =
  `${XML}<pickResult><pickedCard blueprintId="1_2" count="2"/><pickedCard blueprintId="1_3" count="1"/>` +
  NEXT_PICKS.map(pick).join('') +
  '</pickResult>';

/** Picks shown by a picture (singleCollectionPick): an id and an image, no blueprint. */
const PICTURE_PICKS =
  `${XML}<availablePicks>` +
  ['fp-elven', 'fp-dwarven', 'shadow-moria']
    .map((id) => `<availablePick id="${id}" url="https://i.lotrtcgpc.net/draft/${id}.png"/>`)
    .join('') +
  '</availablePicks>';

const LEGACY = {
  pick: '#picksDiv .card .actionArea',
  drafted: '#draftedDiv .card .actionArea',
};
const ANGULAR = {
  pick: '.gd-draft-picks .gd-card',
  drafted: '.gd-drafted-pool .gd-card',
};
const controls = (which) => (which === 'legacy' ? LEGACY : ANGULAR);

export default {
  name: 'solo-draft',
  legacy: `/gemp-lotr/soloDraft.html?eventId=${EVENT}`,
  angular: `/gemp-lotr/ng/draft/solo?eventId=${EVENT}`,
  answer(path, url, request) {
    if (path === '/player') return { file: 'player.json', type: 'application/json' };
    if (path === `/soloDraft/${EVENT}`) {
      return request.method() === 'POST' ? { xml: PICK_RESULT } : { xml: picks(FIRST_PICKS) };
    }
    if (path === `/collection/${EVENT}`) return { xml: collection(POOL) };
    return null;
  },
  scenarios: [
    { name: 'initial', act: async () => {} },
    {
      name: 'picked',
      act: async (page, which) => {
        await page.locator(controls(which).pick).first().click();
        await page.waitForTimeout(300);
        await page.mouse.move(0, 0);
      },
    },
    {
      name: 'card-info',
      act: async (page, which) => {
        await page
          .locator(controls(which).drafted)
          .nth(2)
          .click({ modifiers: ['Shift'] });
        await page.waitForTimeout(300);
      },
    },
    { name: 'picture-picks', answers: { [`/soloDraft/${EVENT}`]: { xml: PICTURE_PICKS } }, act: async () => {} },
    {
      name: 'finished',
      answers: { [`/soloDraft/${EVENT}`]: { xml: picks([]) } },
      act: async () => {},
    },
    {
      name: 'empty-pool',
      answers: { [`/collection/${EVENT}`]: { xml: collection([]) } },
      act: async () => {},
    },
    // Without ?eventId= the legacy page asked for /soloDraft/null (404, an alert a screenshot doesn't show)
    {
      name: 'no-event',
      legacy: '/gemp-lotr/soloDraft.html',
      angular: '/gemp-lotr/ng/draft/solo',
      act: async () => {},
    },
    { name: 'error', answers: { [`/soloDraft/${EVENT}`]: { status: 500 } }, act: async () => {} },
  ],
};
