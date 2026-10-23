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

### Proposed mobile game hall

```
┌──────────────────────────────┐
│ GEMP          ● Connected  ☰ │  top bar; ☰ opens Help, Events, Server Info,
├──────────────────────────────┤  My Account and the link buttons
│ ⓘ MOTD (one line, tap to open)│
├──────────────────────────────┤
│ ▶ YOUR GAME                  │  your own game is always pinned on top
│ Movie Block · Casual-Glacial │
│ vs tadeorn-son-of-pedreon    │
│ Sites 5–5      [ Play Match ]│
├──────────────────────────────┤
│ Waiting (1) │ Playing (6) │… │  sections as tabs or collapsible lists
│ ┌──────────────────────────┐ │
│ │ Fellowship Block · Casual│ │  each table is a card instead of a row:
│ │ Longshanks · waiting 1:17│ │  format, table info, players, status
│ │             [ Join Table ]│ │  and one big action button
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ Hall │ Play │ Decks │ Chat │ ⋯│  bottom navigation, always visible
└──────────────────────────────┘
```

- **Play** opens creating or joining a table. **Chat** shows the Discord chat and the online players full screen.
- On tablets and in landscape, the table list and the chat sit side by side.
- The menu has a "Standard view" switch back to the desktop hall.

## 4. Phases

Each phase is a set of small commits on the `Piotr-Mobile` branch, and each one ends in something you can try out.

### Phase 0 – PWA shell and groundwork ✅ done

What was built:

- `images/icons/site.webmanifest`: name "GEMP: LotR-TCG", short name "GEMP", start page `/gemp-lotr/hall.html`, scope `/gemp-lotr/`, standalone display, any orientation, dark theme color, and the 192 px and 512 px icons with absolute paths.
- `sw.js` (served at `/gemp-lotr/sw.js`): the service worker. For the site's own static files it always tries the server first and falls back to the saved copy only when the server can't be reached. It keeps one copy per page whatever the query string. It never handles game or server calls (`/gemp-lotr-server/…`), share links or card images from other hosts. A page that was never visited shows `offline.html` when the server can't be reached.
- `js/gemp-022/pwa.js`: registers the service worker. It's included in `index.html`, `hall.html` and `game.html`, together with a `theme-color` tag.
- Server (`GempukkuHttpRequestHandler.getHeadersForFile`): correct content types for `.webmanifest`, `.json`, `.webp` and `.ico`, and no HTTP caching for `sw.js`, so a new version reaches players right away.
- `mobile-client/dev/start-local-server.sh`: starts a local server (MariaDB in Docker, server built with Maven) for development. Test login: `asdf` / `asdf`.

Checked on the local server in an emulated Pixel 7 browser:

- The manifest, icons and `sw.js` are served with the right types.
- The service worker installs and controls the pages. 97 static files were cached and 0 server calls.
- With the server stopped, the hall still opens from the saved copy, and a never-visited page shows the offline page.

The viewport tag was **not** added to the existing login and hall pages. Their desktop layout would get squeezed on a phone. They get it together with their mobile versions in Phase 4.

The original task list for Phase 0:


- Fix the web manifest: give it a name, icons, `start_url` set to `/gemp-lotr/hall.html`, a theme color, and `display: standalone`.
- Add a small **service worker** that caches only the app's own static files (scripts, styles, icons). It must never cache game or server API calls, so live games always come from the server.
- Server: add content types for `.webmanifest`, `.json` and `.webp` in `GempukkuHttpRequestHandler.getHeadersForFile`. Today those files are sent as `application/octet-stream`.
- Add `<meta name="viewport">` to the mobile page and to the pages a mobile user visits (login, hall).
- **Result:** "Add to home screen" on Android installs Gemp as an app that opens the hall.

### Phase 1 – Mobile game screen, read-only ✅ done

What was built (all in `gemp-lotr-async/src/main/web/`):

- `game-mobile.html`: the mobile game page, for a live game (`?gameId=`) or a replay (`?replayId=`).
- `src/GameMobile/state.js`: the game state model. It handles every event the server sends (cards in play, moves, attachments and stacking, tokens, assignments including split skirmishes, skirmishes, stats, piles, threats, decisions, messages and clocks). It's plain JavaScript and is tested in Node (`mobile-client/dev/test-state.js`).
- `src/GameMobile/render.js`: draws the state.
  - Status bar: phase, twilight, initiative, moves, archery, rule of 4, and the players with clocks, hand, deck and threats.
  - Adventure path strip with the player markers. It scrolls to where the players are.
  - Rows of cards that scroll sideways. Each card shows its strength, vitality and resistance (or site number) and its tokens. Attached and stacked cards are drawn small **under** their card, with a "+N" badge.
  - Skirmish shown as "your side vs. minions" with the strength totals, damage bonus and overwhelmed. Assignments shown as pairs; a split skirmish's waiting minions face a faded copy of the character.
  - Tapping a card opens it full size, with its stats, tokens, the cards attached and stacked, and (live) its modifiers. Tapping a player shows their piles and the cards known in them. Tapping a card name in the log shows that card.
  - The hand in a bottom sheet on phones and always visible on tablets. The game log in a sheet, or on the right on landscape tablets.
  - Event cards being played and cards being used are shown briefly, like the desktop animations.
- `src/GameMobile/gameMobile.js`: connects to the server with the desktop client's calls (live game with polling, or replay with play/pause, step and speed).
- `src/GameMobile/index.css`: the layouts.
  - Phone portrait: everything stacked; the page scrolls up and down only, and each row scrolls sideways.
  - Phone landscape: smaller cards, a one-line status bar, and the opponent's side on the left with the skirmish and your side on the right.
  - Tablet: bigger cards and the hand under the table. In landscape, the same two halves as on the phone, plus the game log on the right.

Read-only for now: when it's your decision, the bottom bar shows it with a link to answer in the standard view.

Checked on the local server (screenshots in an emulated Pixel 7 and Galaxy Tab S4, portrait and landscape):

- A replay at the start, during assignments, during skirmishes and at the end. No script errors, and the page never scrolls sideways.
- Spectating a live game (followed to the end), and a player's own pending decision.

Development tools: `mobile-client/dev/` (see its README). `autoplay.js` plays whole games between the test users, and a recorded game is kept in `fixtures/` for the state tests.

The original task list for Phase 1:


- Create `game-mobile.html`, `src/GameMobile/` and the game state model with its event processor (all ~25 event types).
- Build the renderer: status bar, adventure path strip, zone rows, skirmish and assignment pairs, token and attachment badges, and the long-press card view.
- Develop it against **replays** (`game-mobile.html?replayId=…`) and spectating.
- **Result:** you can watch a replay or spectate a live game on a phone, and everything on the table can be read.

### Phase 2 – Playing: decisions and actions ✅ done

What was built:

- `src/GameMobile/decisions.js`: one handler per decision type. Each knows which cards can be tapped, what is selected, which buttons to show and the answer to send. The answers use the same format as the desktop client.
  - **Number** (`INTEGER`): − and + buttons with the number between them, and OK.
  - **Multiple choice:** one big button per answer.
  - **Choosing cards on the table** (`CARD_SELECTION`): tap to select or deselect, up to the maximum. Done is enabled once the minimum is reached, and Reset clears the selection.
  - **Choosing from shown cards** (`ARBITRARY_CARDS`, such as the starting fellowship or a deck search): the cards appear in a strip in the bottom panel. Cards that can't be chosen are dimmed.
  - **Choosing an action** (`ACTION_CHOICE`): the actions appear as cards with their text underneath.
  - **Using a card or passing** (`CARD_ACTION_CHOICE`): playable cards on the table and in hand are highlighted. One tap selects a card, and a card with several actions asks which one. Cards playable from elsewhere (the discard pile, for example) appear in the strip. Pass or Done.
  - **Assigning minions:** tap a minion, then the character; tap the minion again to unassign. The table shows the pairs as you make them. Reset goes back to the assignments that were already made, and you're asked to confirm if a minion is left unassigned.
- Tapping a highlighted card selects it, and a long press always opens the card in full. Selectable cards have a gold frame, and selected ones a green frame with a ✓.
- On phones, your hand appears inside the bottom panel whenever it takes part in the decision. If cards to choose are off screen, the table scrolls to the first one.
- `gameMobile.js` sends the answer (`gameDecisionMade`) and continues with the server's reply. Note: the server numbers every decision "1".

Checked on the local server:

- **Node tests:** `mobile-client/dev/test-decisions.js`, 15 tests of every decision type's taps, buttons and answers. The state tests (11) still pass.
- **Full games through the mobile page:** `mobile-client/dev/mobile-player.js` plays asdf's whole game by tapping cards and buttons (random choices) while `autoplay.js` plays qwer. Seven complete games on phone portrait, phone landscape, tablet portrait and tablet landscape, with all 7 decision types answered and no script errors.
- Replays still show correctly at all four sizes.

Not done yet (Phase 3): the desktop settings (auto-pass phases, auto-accept, …), timers counting down, sound or vibration when it's your turn, chat, and concede.

The original task list for Phase 2:


- Port the 7 decision types to the touch decision panel: choosing cards, choosing an action on a card, a number, multiple choice, and assigning minions.
- Card selection: tap to select, highlight valid choices, and a clear Done or Pass button.
- Assigning minions: tap a minion, then tap a companion. Drag and drop comes as an extra later.
- Auto-pass and auto-accept settings, taken from the existing settings.
- **Result:** a full game can be played from a phone against a desktop player.

### Phase 3 – The rest of the game screen ✅ done

What was built:

- **Chat** (`src/GameMobile/chat.js`): the game's chat room ("Game<id>", the same room as the desktop chat tab). It has a Chat button with an unread badge, and a chat sheet showing the messages, who is in the room, and a text field that keeps the keyboard open while messages arrive. Spectators can chat too. It uses its own connection, so a chat problem never stops the game.
- **Menu:** Chat and players, Game info, Settings, Request game cancel and Concede game. The last two ask for confirmation. After either one, the page listens to the server even while a decision is waiting, so the end of the game arrives.
- **Settings** (`src/GameMobile/settings.js`), remembered on the device:
  - Auto-pass per phase, "send at once after choosing" (auto-accept) and skipping the look at your own deck. These use the **same cookies as the desktop**, so they're shared with the standard view.
  - Sound, vibration and timer warnings (mobile only).
  - Auto-accept is **off by default** on mobile, because a stray tap shouldn't play a card.
- **Auto-pass reaches the server:** the server reads the `autoPassPhases` cookie, but the desktop saves it only for `/gemp-lotr`, so the browser never sends it to `/gemp-lotr-server`. In other words, **the desktop's auto-pass setting has no effect today** (checked in a real browser). The mobile page also saves it for `/`, so it works there. If no phase is selected, it sets the server's `autoPass=false` switch instead, because an empty list would make the server fail.
- **Clocks:** your time bank and the decision clock (time taken / time allowed, shown next to the question) count down every second between server updates. They turn orange, then red, as time runs low. Warnings (sound and vibration, if switched on) come at 60, 30 and 10 seconds and every second below that for the decision, and regularly in the last minutes of the time bank.
- **Your move:** the page title changes to "▶ Your move", the phone vibrates briefly, and a sound plays if the game is in the background.
- **Game over:** a screen with "You won!" or "You lost", the reason, a link to the replay and the way back to the hall.
- **Reconnecting:** if the network drops or the phone sleeps, a "Connection lost. Reconnecting…" banner appears and the page loads the game again. It tries 6 times over about 2 minutes, immediately when the page comes back to the foreground. A decision that was being sent is simply asked again. It also rejoins after the server's "inactive for too long" answer.

Checked on the local server:

- **Decision tests:** `dev/test-decisions.js` now has 16 tests (auto-accept added), and the state tests (11) still pass.
- **Feature checks:** `dev/mobile-features.js` runs in a live game against the auto-player and passed several runs. It checks the your-move title; the clocks counting down; chat both ways with the unread badge; the auto-pass cookie actually sent to the server; the network dropping while an answer is sent, then recovering; and conceding, ending on the "You lost" screen with a replay link.
- **Full games:** whole games still play through the mobile page on phone and tablet, and replays still show at all four sizes.

**Known issue (also on the desktop):** on the local test server, chat messages are often lost while a game page is open. The **desktop game page loses them the same way**, while plain HTTP calls and pages without a game deliver them fine. So it's in the server or this local setup, not in the mobile page. It needs checking on the real server, where people use the desktop chat every day.

The original task list for Phase 3:


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

## 6. Decisions (answered by Piotr)

1. **Orientation:** phones play in both **portrait and landscape**. **Tablets** are covered from the start, not only in Phase 5.
2. **Drag and drop:** **tap-then-tap** for the first version. Drag and drop comes later.
3. **Test server:** to be decided. My recommendation is in the next section.
4. **Opening the mobile view:** phones and tablets switch to the mobile screens **automatically**, with an option to go back to the standard (desktop) view.
5. **Scope:** the **game hall** also gets a mobile PWA version, not only the game screen. See the screenshot and notes in REMARKS.md, and the proposed layout in section 3.

Effect on the phases:

- The tablet and landscape layouts move from Phase 5 into Phases 1–3. Every screen is designed for phone portrait, phone landscape and tablet from the start.
- The mobile hall moves up from "make it usable" to a proper mobile hall screen in Phase 4.

## 7. Test server

- **For development:** a local server inside this cloud environment. Docker, Java and Maven are all available here, and the repo has a `docker/` setup. I can run the server with a test database, and test the mobile screens in an emulated phone browser. Nothing is needed from you for this.
- **For trying it on your own phone:** the server must be reachable from the internet over **HTTPS**. There are two options:
  - **Free and quick:** run the docker setup on your own computer and expose it with a tunnel such as Cloudflare Tunnel (free, gives an HTTPS address). It only works while your computer is on.
  - **Always on:** a small cloud server (Azure, Hetzner, DigitalOcean…) running the docker setup behind Caddy or nginx with a free Let's Encrypt certificate. Around 5–30 EUR a month depending on the provider and size. Azure works fine; Hetzner or DigitalOcean are simpler and cheaper.
- This isn't needed until Phase 2 (playing a game from your phone), so there's no rush.
