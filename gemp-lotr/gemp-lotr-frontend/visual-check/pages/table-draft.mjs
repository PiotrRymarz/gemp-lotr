// The table draft: the legacy tableDraft.html and the Angular page at /gemp-lotr/ng/draft/table, both with
// ?eventId=VCHECK. GET /tableDraft/VCHECK is the player's status (three seats, a timed pick of the first pack, a dozen
// drafted cards); declaring a card (POST) marks it and its seat, and the following polls say so too. Both pages poll
// every 500 ms (`polls`: stubbed.mjs waits a fixed time rather than for the network to go idle).
//
// The legacy page's chat ("Draft-VCHECK") is answered with an empty room, so its box stays empty; the Angular page's
// chat region is a placeholder for now (the chat comes with the shared chat UI), so only its box is compared.
const EVENT = 'VCHECK';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';

/** The cards drafted so far: [blueprintId, count], as the server sorts them. */
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
const PACK = ['1_2', '1_45*', '1_319', '1_7', '1_12', '1_340', '1_2'];
const SEATS = ['alice', 'bob', 'carol', 'dave'];

/** A <draftStatus>: `chosen` is the declared card of the pack (every copy is marked), `seatsChosen` the seats done. */
function status({ pack = PACK, chosen = null, seatsChosen = ['bob'], ascending = true, time = 65, round = [1, 3] }) {
  return (
    `${XML}<draftStatus>` +
    SEATS.map((name) => `<player hasChosen="${seatsChosen.includes(name)}" name="${name}"/>`).join('') +
    `<pickOrderAscending value="${ascending}"/>` +
    POOL.map(([id, count]) => `<pickedCard blueprintId="${id}" count="${count}"/>`).join('') +
    pack
      .map((id) => `<availablePick blueprintId="${id}"${id === chosen ? ' chosen="true"' : ''} id="${id}"/>`)
      .join('') +
    (time === null ? '' : `<timeRemaining value="${time}"/>`) +
    (round ? `<roundsInfo currentRound="${round[0]}" roundsTotal="${round[1]}"/>` : '') +
    '</draftStatus>'
  );
}

const WAITING = { chosen: '1_2', seatsChosen: ['alice', 'bob'] };

/** The pages that declared a card: their polls answer with it declared. */
const declared = new WeakSet();
const pageOf = (request) => {
  try {
    return request.frame().page();
  } catch {
    return null;
  }
};

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
  name: 'table-draft',
  legacy: `/gemp-lotr/tableDraft.html?eventId=${EVENT}`,
  angular: `/gemp-lotr/ng/draft/table?eventId=${EVENT}`,
  polls: true,
  answer(path, url, request) {
    if (path === '/player') return { file: 'player.json', type: 'application/json' };
    if (path === `/tableDraft/${EVENT}`) {
      const page = pageOf(request);
      if (request.method() === 'POST') {
        if (page) declared.add(page);
        return { xml: status(WAITING) };
      }
      return { xml: status(page && declared.has(page) ? WAITING : {}) };
    }
    // The legacy chat: an empty room, asked again every 3 s
    if (path.startsWith('/chat/')) return { xml: `${XML}<chat/>` };
    return null;
  },
  scenarios: [
    { name: 'picking', act: async () => {} },
    {
      name: 'declared',
      act: async (page, which) => {
        await page.locator(controls(which).pick).first().click();
        await page.waitForTimeout(800);
        await page.mouse.move(0, 0);
      },
    },
    { name: 'waiting', answers: { [`/tableDraft/${EVENT}`]: { xml: status(WAITING) } }, act: async () => {} },
    {
      name: 'pass-up',
      answers: {
        [`/tableDraft/${EVENT}`]: { xml: status({ ascending: false, time: null, round: [2, 3], seatsChosen: [] }) },
      },
      act: async () => {},
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
    {
      name: 'finished',
      answers: { [`/tableDraft/${EVENT}`]: { xml: status({ pack: [], seatsChosen: [], time: null, round: [3, 3] }) } },
      act: async () => {},
    },
    // Without ?eventId= the legacy page polled /tableDraft/null (404: the lost-connection warnings in its chat)
    {
      name: 'no-event',
      legacy: '/gemp-lotr/tableDraft.html',
      angular: '/gemp-lotr/ng/draft/table',
      act: async () => {},
    },
    // A failed poll: polling stops and the warnings are shown (the legacy page wrote them in its chat)
    { name: 'lost', answers: { [`/tableDraft/${EVENT}`]: { status: 500 } }, act: async () => {} },
  ],
};
