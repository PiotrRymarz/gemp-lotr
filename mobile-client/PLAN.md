# Mobile Client – Analysis & Plan

Target: a **mobile web version** of the Gemp-LotR client, installable on Android as a **PWA**.
It uses the same server as the desktop web client, so mobile players and browser players play together.

See [REMARKS.md](REMARKS.md) for the requirements and the current-screen notes.

---

## 1. How the current client works

All paths below are relative to `gemp-lotr/gemp-lotr-async/src/main/web/` unless stated otherwise.

### Pages and scripts

- The game screen is `game.html`, bootstrapped by `src/Game/game.js`, which creates `GempLotrGameUI`.
- The main scripts are:

| File | Lines | Role |
|---|---|---|
| `js/gemp-022/gameUi.js` | ~3,200 | Game screen: layout, dialogs, the 7 decision types, timers |
| `js/gemp-022/gameAnimations.js` | ~1,300 | Applies each server event to the table, with animations |
| `js/gemp-022/communication.js` | ~2,200 | All HTTP calls to the server (game, hall, decks…) |
| `js/gemp-022/cards/Card.js`, `CardGroup.js`, … | ~3,500 | Card model, image URLs, card rows and their layout |
| `js/gemp-022/chat.js` | ~900 | Chat box |
| `js/gemp-022/hallUi.js` | ~1,800 | Game hall (lobby) |

- The libraries are old: jQuery 1.6.2 and jQuery UI 1.8.16. There's no build step; the pages load plain `<script>` tags.

### Talking to the server (protocol)

The game uses plain HTTP with XML responses and long polling:

| Call | Request | Purpose |
|---|---|---|
| Start | `GET /gemp-lotr-server/game/{gameId}` | Full game state as a list of events |
| Update | `POST /gemp-lotr-server/game/{gameId}` with `channelNumber` | Waits for new events (long poll, 20 s timeout) |
| Decision | `POST` the same URL with `decisionId` and `decisionValue` | Sends the player's answer and gets new events back |
| Card info | `GET …/game/{gameId}/cardInfo?cardId=` | Modifiers on a card (HTML) |
| Concede / cancel | `POST …/concede`, `…/cancel` | |

- Login is a session cookie on the same site. A mobile page served from the **same server** (`/gemp-lotr/…`) is logged in automatically, with no server change.
- The server sends about 25 event types (`<ge type="…">`), for example: put card in play (`PCIP`), move (`MCIP`), remove (`RCFP`), phase change (`GPC`), twilight pool (`TP`), assignments (`AA`/`RA`), skirmish (`SS`/`ATS`/`RFS`/`ES`), tokens (`AT`/`RT`), player position (`PP`), stats (`GS`), decision (`D`) and end of game (`EG`).
- There are 7 decision types: `INTEGER`, `MULTIPLE_CHOICE`, `ARBITRARY_CARDS`, `ACTION_CHOICE`, `CARD_ACTION_CHOICE`, `CARD_SELECTION` and `ASSIGN_MINIONS`.
- **Replays** use the same events (`game.html?replayId=…`). That makes them very useful for building and testing the mobile screen without needing two players.

### Why the current screen fails on phones

- **No separate game state.** The state of the table lives in the page itself: each card is an HTML element with its data attached, and the code finds cards by searching the page.
- **Fixed desktop layout.** `layoutUI()` computes absolute pixel positions for every row, using fixed 150 px side columns and a 302 px chat column. Nothing reflows on a small screen. That's why you have to drag the page around.
- **Hidden cards.** Attached and stacked cards are drawn as overlapping slices behind their host card, so on a small screen they can't be read or tapped.
- **Pages aren't set up for phones.** There's no `<meta name="viewport">` tag on any page, so phones render the desktop width and zoom out.
- **Not a working PWA.** `images/icons/site.webmanifest` exists, but it has an empty name, wrong icon paths and no service worker.

### What can be reused

- `communication.js`: all server calls, unchanged.
- `Card.js`: card image URLs, card data, errata and foil logic.
- `chat.js`: the chat logic. Only its look needs restyling.
- The decision logic in `gameUi.js`, which decides what each decision means and what answer to send. It can be ported, but its dialogs have to be replaced with touch-friendly ones.

---

## 2. Approach

**Build a separate mobile game page, `game-mobile.html`, next to `game.html`.** It reuses the communication and card code, but it gets its own:

1. **Game state model.** A plain JavaScript object that holds the cards by id, their zones, attached and stacked cards, tokens, assignments, the current skirmish, the phase, the twilight pool, stats and clocks. A new event processor fills it from the same server events.
2. **Mobile renderer.** It draws the state with normal CSS (flexbox and grid) instead of absolute pixel positions, so the layout fits any screen size and orientation.
3. **Touch decision panel.** It shows the current decision in a fixed panel at the bottom, with large buttons.

Why a separate page instead of making `game.html` responsive:

- The current layout code assumes a desktop grid throughout. Changing it risks breaking the desktop client that all players use today.
- A separate state model keeps the rendering simple and makes it possible to test the event processing without a browser.
- Desktop players are unaffected. Both pages talk to the same server, so mobile and desktop players can play each other from day one.

**Server changes are minimal:** content types for the PWA files, and possibly a link from the hall (see Phase 0 and Phase 4). The game protocol doesn't change.

---

## 3. Proposed phone layout

The picture below is for **portrait** orientation. Landscape and tablets show more at once (see Phase 5).

```
┌──────────────────────────────┐
│ Skirmish · ⏳0 · Init: Shadow │  status bar: phase, twilight, initiative,
│ rymy_16 33│2│3/7  · 21:25    │  players and clocks (tap for details)
├──────────────────────────────┤
│ Sites: [1][2][3][④][5]…      │  adventure path: one compact strip
├──────────────────────────────┤
│ Opponent support   ◀ ▢▢▢▢ ▶  │  each zone is a row that scrolls
│ Opponent companions◀ ▢▢▢▢ ▶  │  sideways, with small cards
├──────────────────────────────┤
│ Skirmishes / assignments     │  one "pair" per companion:
│  [minion]  vs  [companion]   │  minion(s) vs. companion,
│  [minion]  vs  [companion]   │  active skirmish highlighted
├──────────────────────────────┤
│ My companions      ◀ ▢▢▢▢ ▶  │
│ My support         ◀ ▢▢▢▢ ▶  │
├──────────────────────────────┤
│ Choose next skirmish         │  decision panel: fixed at the
│ [ Pass ]        [ Done ]     │  bottom, big buttons
├──────────────────────────────┤
│ Hand (5) ▲  │ Chat │ Menu    │  hand opens as a drawer
└──────────────────────────────┘
```

How it addresses your remarks:

- **Too big to fit:** cards are drawn small inside rows that scroll sideways, so the page itself never scrolls sideways. The zones are stacked top to bottom in a fixed order, so you always know where to look.
- **Covered cards:** each card shows a small badge with the number of attached and stacked cards. Long-pressing a card opens a full-screen view of that card, its attached and stacked cards, its tokens and its modifiers (from `cardInfo`).
- **Clicking everywhere:** the decision panel at the bottom always shows what's being asked and the buttons to answer. Cards you can choose are highlighted; tapping one selects it. **Drag and drop** can be added on top for assignments, for example dragging a minion onto a companion, with tap-then-tap as the always-available fallback.

---

## 4. Phases

Each phase is a set of small commits on the `Piotr-Mobile` branch, and each one ends in something you can try out.

### Phase 0 – PWA shell and groundwork

- Fix the web manifest: give it a name, icons, `start_url` set to `/gemp-lotr/hall.html`, a theme color, and `display: standalone`.
- Add a small **service worker** that caches only the app's own static files (scripts, styles, icons). It must never cache game or server API calls, so live games always come from the server.
- Server: add content types for `.webmanifest`, `.json` and `.webp` in `GempukkuHttpRequestHandler.getHeadersForFile`. Today those files are sent as `application/octet-stream`.
- Add `<meta name="viewport">` to the mobile page and to the pages a mobile user visits (login, hall).
- **Result:** "Add to home screen" on Android installs Gemp as an app that opens the hall.

### Phase 1 – Mobile game screen, read-only

- Create `game-mobile.html`, `src/GameMobile/` and the game state model with its event processor (all ~25 event types).
- Build the renderer: status bar, adventure path strip, zone rows, skirmish and assignment pairs, token and attachment badges, and the long-press card view.
- Develop it against **replays** (`game-mobile.html?replayId=…`) and spectating.
- **Result:** you can watch a replay or spectate a live game on a phone, and everything on the table can be read.

### Phase 2 – Playing: decisions and actions

- Port the 7 decision types to the touch decision panel: choosing cards, choosing an action on a card, a number, multiple choice, and assigning minions.
- Card selection: tap to select, highlight valid choices, and a clear Done or Pass button.
- Assigning minions: tap a minion, then tap a companion. Drag and drop comes as an extra later.
- Auto-pass and auto-accept settings, taken from the existing settings.
- **Result:** a full game can be played from a phone against a desktop player.

### Phase 3 – The rest of the game screen

- Chat (as a tab or sheet), the players list, game options (concede and request cancel), and settings.
- Timers and the decision clock, the "your turn" sound and vibration, and the end-of-game screen.
- Reconnecting after the phone sleeps or the network drops. On mobile this matters more than on desktop.

### Phase 4 – Getting into games from a phone

- When the hall is opened on a touch device or a small screen, its game links point to `game-mobile.html` instead of `game.html`. A "Desktop / Mobile view" switch is remembered on the device.
- Make the login page and the hall (game list, creating and joining a table, choosing a deck) usable on a phone.

### Phase 5 – Polish and later

- A tablet and landscape layout that shows more zones side by side.
- Optional extras: drag and drop, swiping between zones, card image preloading, offline card image cache.
- Deck builder on mobile, which is a separate, larger piece of work.
- A Play Store listing through a Trusted Web Activity. This needs `/.well-known/assetlinks.json`, but `WebRequestHandler` currently refuses any path containing `/.`, so a small server change would be needed then.

---

## 5. Testing

- **Event processing:** test the state model against saved event XML from real games and replays.
- **Screen:** use Playwright's phone emulation (for example a Pixel or Galaxy screen size) to load replays and take screenshots. It's already available in this cloud environment.
- **Real devices:** you test on your Android phone and tablet against a test server, and on the real server once ready.
- **Desktop regression:** `game.html` stays unchanged, so the desktop client isn't affected.

---

## 6. Open questions for Piotr

1. **Orientation:** should phones play in **portrait**, **landscape** or both?
2. **Drag and drop:** where exactly do you want it? For example, assigning minions to companions, or playing cards from the hand. Is tap-then-tap enough as the first version?
3. **Server for testing:** is there a test server we can deploy to, or should I set up a local one in this environment (the repo has a `docker/` setup)? Installing a PWA requires **HTTPS**, except on `localhost`.
4. **Opening the mobile view:** should the hall switch to the mobile game screen automatically on phones, or only when the player chooses it?
5. **Scope of the first release:** is the game screen enough at first, with the hall and deck builder kept as they are?
