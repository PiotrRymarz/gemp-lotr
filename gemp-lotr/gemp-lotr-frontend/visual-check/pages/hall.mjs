// The hall frame and its chat (part 4.1): the legacy hall.html and the Angular page at /gemp-lotr/ng/hall, on the Game
// Hall tab. GET /hall answers a snapshot with no tables or queues (the MOTD and the server clock only); the long polls
// (POST /hall/update, POST /chat/Game%20Hall) are left waiting, as a quiet server does, so the page stays as first
// drawn. GET /chat/Game%20Hall is chat.xml's
// five messages and four players. The player is "alice" (so bob's "@alice" is a
// ping and carol's "alice" a mention); she ignores carol.
//
// Compare the frame and the chat only. Drawn by later parts, so excluded: the Game Hall tab's tables (legacy: the four
// empty table sections, between the MOTD and the main bar; Angular: an empty placeholder, 4.2), the other tabs'
// content (4.3-4.5), the Play popup (4.2). The legacy chat defaults to Discord (an embed from a CDN, not loaded here),
// as the Angular one does; the scenarios but "initial" choose the built-in chat.
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
const HALL =
  `${XML}<hall channelNumber="7" currency="1234" motd="Welcome &lt;b&gt;back&lt;/b&gt;!" ` +
  'serverTime="2026-11-09 14:03:05" serverTimeMs="1794232985000"/>';
const PLAYER = { json: { hasTrophies: true, name: 'alice', type: 'un' } };
const CHAT = '/chat/Game%20Hall';
/** chat.xml, its tournament message addressed to other players (to alice it opens 4.2's "Tournament Update" dialog). */
const CHAT_XML =
  `${XML}<chat roomName="Game Hall">` +
  '<message date="1794232800000" from="System">Welcome to room: Game Hall</message>' +
  '<message date="1794232860000" from="bob">&lt;p&gt;hi @alice, see &lt;a href="https://wiki.lotrtcgpc.net" ' +
  'target="_blank"&gt;https://wiki.lotrtcgpc.net&lt;/a&gt;&lt;/p&gt;</message>' +
  '<message date="1794232870000" from="carol">&lt;p&gt;alice is great&lt;/p&gt;</message>' +
  '<message date="1794232880000" from="TournamentSystemTo:dave;erin">Your &lt;b&gt;round 2&lt;/b&gt; game is ready' +
  '</message><message date="1794232890000" from="System">You\'re now in the Legacy chat.  Use this if Discord goes ' +
  'down.</message><user self="true" incognito="false">alice</user><user role="admin">bob</user><user>carol</user>' +
  '<user>+ dave</user></chat>';

const LEGACY = {
  readout: '.hall-connection-readout',
  player: (name) => `.chatUser[data-name="${name}"]`,
};
const ANGULAR = {
  readout: '.gd-hall-connection__readout',
  player: (name) => `.gd-chat__player:has(.gd-chat__name:text-is("${name}"))`,
};
const controls = (which) => (which === 'legacy' ? LEGACY : ANGULAR);

/** The built-in chat rather than Discord (the choice both chats keep in localStorage). */
const builtinChat = (context) => context.addInitScript(() => window.localStorage.setItem('gemp.hallChat', 'builtin'));

export default {
  name: 'hall',
  legacy: '/gemp-lotr/hall.html',
  angular: '/gemp-lotr/ng/hall',
  // The hall and the chat long-poll (their polls are left unanswered): the page never goes idle
  polls: true,
  init: builtinChat,
  answer(path, url, request) {
    if (path === '/player') return PLAYER;
    if (path === '/player/ignores') return { file: 'ignores.json', type: 'application/json' };
    if (path === '/hall') return { xml: HALL };
    if (path === '/hall/update') return { hang: true };
    if (path === CHAT) return request.method() === 'GET' ? { xml: CHAT_XML } : { hang: true };
    return null;
  },
  scenarios: [
    { name: 'initial', init: async () => {}, act: async () => {} },
    { name: 'chat', act: async () => {} },
    {
      // A poll answered 409 (the hall opened in another window): red "Disconnected", the popup pinned by a click
      name: 'connection-lost',
      answers: { '/hall/update': { status: 409 } },
      act: async (page, which) => {
        await page.waitForTimeout(500);
        await page.locator(controls(which).readout).click();
        await page.waitForTimeout(200);
      },
    },
    {
      // A poll that failed (503): amber "Reconnecting", the popup shown on hover
      name: 'reconnecting',
      answers: { '/hall/update': { status: 503 } },
      act: async (page, which) => {
        await page.waitForTimeout(300);
        await page.locator(controls(which).readout).hover();
        await page.waitForTimeout(200);
      },
    },
    {
      // A visitor: the hall, the chat and the player answer 401
      name: 'visitor',
      answers: { '/hall': { status: 401 }, [CHAT]: { status: 401 }, '/player': { status: 401 } },
      act: async () => {},
    },
    {
      name: 'user-menu',
      act: async (page, which) => {
        await page.locator(controls(which).player('bob')).click();
        await page.waitForTimeout(200);
      },
    },
  ],
};
