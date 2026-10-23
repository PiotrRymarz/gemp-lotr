# Handoff: where the mobile client work stands

Notes for the next session. When Piotr types "continue", **read this file first**, then
[PLAN.md](PLAN.md) and [REMARKS.md](REMARKS.md), and carry on from "Next step" below.

Last updated: end of the session that finished Phase 3 (2026-10-23).

## Context in one paragraph

Piotr wants an Android (phone and tablet) version of the Gemp-LotR client, so mobile players can play against desktop
browser players on the same server. We chose a **mobile web version installed as a PWA**, built as separate pages
next to the desktop ones (`game.html` stays untouched). All work is on branch **`Piotr-Mobile`** of
`trymarz/gemp-lotr-private`. Piotr is not a web developer: explain in plain words, keep him informed, and commit and
push after each meaningful step (he relies on GitHub to keep the work).

## Decisions already made (don't ask again)

- Mobile web version and PWA first. A Play Store listing (Trusted Web Activity) maybe later.
- Phones in **portrait and landscape**, and **tablets**, from the start.
- **Tap-then-tap** first; drag and drop later.
- Phones and tablets switch to the mobile screens **automatically**, with an option back to the standard view (Phase 4).
- The **game hall** gets a mobile version too (Phase 4). Its layout is sketched in PLAN.md, section 3.
- Test server: develop against a **local server in the cloud session**. A public HTTPS server only when Piotr wants to try it on his phone (options in PLAN.md, section 7). He has none yet.
- Piotr agreed to use **high** reasoning effort for Phases 1–2.

## Status

- ✅ **Phase 0**: PWA shell. Manifest, service worker `sw.js` (network-first, own static files only), offline page, content types on the server.
- ✅ **Phase 1**: read-only mobile game screen `game-mobile.html` (state model, renderer, live and replay). Details in PLAN.md.
- ✅ **Phase 2**: playing from the phone. All 7 decision types (`decisions.js`), tap to select, long press for details. Tested with whole games played through the mobile page (`dev/mobile-player.js`).
- ✅ **Phase 3**: the rest of the game screen. Chat, menu (concede, cancel), settings (shared with the desktop through cookies), clocks counting down, your-move signals, game-over screen, reconnecting. Details in PLAN.md.
- ⏭ **Phase 4**: getting into games from a phone (mobile game hall, automatic switch). **This is the next step.**
- Phase 5: see PLAN.md.

## Things to tell Piotr about (found along the way, not changed)

- **The desktop auto-pass setting has no effect.** `gameUi.js` saves the `autoPassPhases` cookie without a path, so it only exists for `/gemp-lotr` and the browser never sends it to the server (`/gemp-lotr-server`). The server then always uses its default phases. Checked in a real browser. The fix would be to save it with `path: "/"` in `gameUi.js`. That changes behaviour for all desktop players, so it's his decision (the mobile page already saves it for `/`).
- **Chat on the local server** loses many messages while a game page is open, on the desktop page too. Check on the real server.

## Next step: Phase 4, getting into games from a phone

From PLAN.md (Phase 4 and section 3, "Proposed mobile game hall"), and Piotr's decision: phones and tablets switch to the mobile screens **automatically**, with a way back to the standard view.

- **Automatic switch:** decide "mobile device" with a touch screen and either side under ~1000 px (or `matchMedia("(pointer: coarse)")`). Remember an explicit choice ("Standard view" / "Mobile view") on the device (cookie or localStorage). Game links in the hall (`hallUi.js`: around line 1105 `openOrOffer(... "/gemp-lotr/game.html?gameId=" ...)` and line 1655) should open `game-mobile.html` on mobile. A small script in `game.html` could also send phones to the mobile page unless they chose the standard view. Don't change anything for desktop users.
- **Mobile game hall** (`hall-mobile.html` or similar), following the sketch in PLAN.md section 3:
  - your game pinned on top with Play Match
  - tables as cards (format, players, status, one big button)
  - a bottom navigation bar: Hall, Play, Decks, Chat, More
  - the ☰ menu with Help, Events, Server Info, My Account, the links and "Standard view"
  The hall's server calls are in `communication.js` (`getHall`, `updateHall`, `joinTable`, `createTable`, `leaveTable`…), and `hallUi.js` shows how the desktop uses them. The hall's own chat is the "Game Hall" room (or Discord; see `chat.js`).
- **Login page** (`index.html`): make it usable on a phone (viewport tag and a simple layout), or give the mobile hall its own login.
- Test with Playwright at phone and tablet sizes, plus a whole flow: log in, create a table, have qwer join (HTTP, like `autoplay.js`), the game opens on the mobile page, play, back to the hall.

## Setting up a new session (the container starts empty)

1. **Get the branch.** The clone may be shallow and on the default branch:
   ```bash
   cd /home/user/gemp-lotr-private   # or wherever the repo is
   git fetch origin Piotr-Mobile && git checkout Piotr-Mobile
   git config --add remote.origin.fetch '+refs/heads/Piotr-Mobile:refs/remotes/origin/Piotr-Mobile'
   git fetch origin Piotr-Mobile && git branch -u origin/Piotr-Mobile
   ```
   The last two lines make `git status` see the GitHub copy; without them a stop hook may claim the branch is unpushed.
2. **Start the local server.** `mobile-client/dev/start-local-server.sh` starts dockerd and MariaDB, bind-mounts the folders, builds with Maven (a few minutes the first time; run it in the background with a long timeout) and starts the server on port 80.
3. **Create the test decks:** `cd mobile-client/dev && node setup-decks.js`.
4. **Make a game:** `node autoplay.js` prints the replay ids, such as `asdf$...`.
5. **Run the tests:** `node test-state.js` (11 should pass) and `node test-decisions.js` (16). For screenshots, use `screenshots.js`; for a whole game through the mobile page, use `mobile-player.js`; for chat, settings, clocks, reconnecting and conceding, use `mobile-features.js` (see `dev/README.md`).

## Gotchas learned the hard way

- **No symlinks for the web folder.** The server refuses files whose real path is outside `web.path` (`/etc/gemp-lotr/web/`), so the folders are **bind-mounted** (`mount --bind`).
- **The `$` in replay ids** must stay as it is in URLs. `encodeURIComponent` turns it into `%24` and the server answers 404.
- **Don't `pkill -f` a pattern that appears in your own command line**, for example in a heredoc: it kills your own shell. Start the server with `nohup ... & echo $! > pidfile` and `kill $(cat pidfile)`.
- **Card images** come from `https://i.lotrtcgpc.net`, which this sandbox blocks. In Playwright, route that host to a placeholder SVG (see `screenshots.js`).
- **Playwright's `setOffline` doesn't affect service workers.** To test offline, stop the server instead.
- **Custom CSS properties computed at `:root`** (like a `--card-w` derived from `--card-h`) don't follow later overrides of `--card-h`. Compute sizes where they're used.
- **Class names:** the card sizes become classes (`mg-row`, `mg-mini`, `mg-path`). Don't name a size after an existing class: "site" clashed with the `.mg-site` slots.
- **The server's long poll** returns after about 20 s with no events: that's normal.
- **Test users:** `asdf`/`asdf`, `qwer`/`qwer`, and `Librarian`/`qwer` (good for spectating).
- **Every decision has id "1".** Don't use the id to tell decisions apart; use the type and text, or the fact that the previous one was sent.
- **In Playwright, tap visible copies of a card** (`.mg-card[data-card-id="…"]:visible`). The tablet hand area exists but is hidden on phones, and `.first()` follows page order.
- **Answering decisions on the desktop:** the formats are in the `*Decision` functions in `gameUi.js`, and `decisions.js` follows them.
