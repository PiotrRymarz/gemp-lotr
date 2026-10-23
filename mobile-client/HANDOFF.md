# Handoff: where the mobile client work stands

Notes for the next session. When Piotr types "continue", **read this file first**, then
[PLAN.md](PLAN.md) and [REMARKS.md](REMARKS.md), and carry on from "Next step" below.

Last updated: end of the session that finished Phase 2 (2026-10-23).

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
- ⏭ **Phase 3**: the rest of the game screen. **This is the next step.**
- Phases 4–5: see PLAN.md.

## Next step: Phase 3, the rest of the game screen

From PLAN.md, Phase 3, plus what Phase 2 left out:

- **Chat:** the desktop client uses `js/gemp-022/chat.js` (`ChatBoxUI`, `beginGameChat`). Reuse its server calls in a Chat sheet or tab, together with the players in the room.
- **Game options:** concede (`comm.concede`) and request a cancel (`comm.cancel`), both behind a confirmation. Put them in the ☰ menu.
- **Settings**, remembered on the device: auto-pass phases, auto-accept after selecting, always use a list for multiple choice, auto-dismiss your own deck reveal, animation speed. The desktop versions are in `game.html` (`#settingsBox`) and how they're applied is in `gameUi.js`. Apply auto-pass in `gameMobile.updateDecision` (answer `""` for `CARD_ACTION_CHOICE` with no cards in phases the player chose) and auto-accept in `decisions.js`.
- **Timers:** count the clocks down locally between server updates (desktop: `startTimerTick`, `renderDecisionClock` in `gameUi.js`). Show the decision clock (`decisionClock` / `decisionLimit`) while it's your decision, and warn when time runs low.
- **Your turn:** a sound (the desktop uses `/gemp-lotr/src/assets/awaiting_decision.mp3`) and/or a short vibration (`navigator.vibrate`) when a decision arrives, and the page title changes like the desktop's `startAnimatingTitle`.
- **End of game:** a clear result screen (who won and why: it's in the last messages), with links to the hall and the replay.
- **Reconnecting:** after the phone sleeps or the network drops, retry `updateGameState` a few times before showing the error. The server answers 410 after long inactivity; then reload the game.

Test the same way as Phase 2: `autoplay.js --players qwer` plus `mobile-player.js`, and Node tests for any new logic.

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
5. **Run the tests:** `node test-state.js` (11 should pass) and `node test-decisions.js` (15). For screenshots, use `screenshots.js`; for a whole game through the mobile page, use `mobile-player.js` (see `dev/README.md`).

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
