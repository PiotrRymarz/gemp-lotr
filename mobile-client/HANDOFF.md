# Handoff: where the mobile client work stands

Notes for the next session. When Piotr types "continue", **read this file first**, then
[PLAN.md](PLAN.md) and [REMARKS.md](REMARKS.md), and carry on from "Next step" below.

Last updated: end of the session that finished Phase 1 (2026-10-22).

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
- ⏭ **Phase 2**: playing from the phone. **This is the next step.**
- Phases 3–5: see PLAN.md.

## Next step: Phase 2, answering decisions on mobile

Goal: a full game can be played from `game-mobile.html` against a desktop player (or `autoplay.js`).

### What the server asks and how to answer

Decisions arrive as a `D` event and are stored in `state.decision` = `{id, type, text, participantId, params}`.
The answer is sent with `comm.gameDecisionMade(decisionId, value, channelNumber, callback, errorMap)`. The response is
an update XML, so process it like any other (`processXml`) and polling continues. The desktop implementations are in
`js/gemp-022/gameUi.js` (line numbers as of this branch):

| Type | Parameters | Answer | Desktop code |
|---|---|---|---|
| `INTEGER` | `min`, `max`, `defaultValue` | the number | `integerDecision` ~1911 |
| `MULTIPLE_CHOICE` | `results[]` | index of the chosen result | `multipleChoiceDecision` ~1958 |
| `ARBITRARY_CARDS` | `min`, `max`, `cardId[]`, `blueprintId[]`, `selectable[]`, `testingText[]`, `deckInspection` | selected card ids, comma-separated. The cards are **not** on the table: show them in a sheet. | `arbitraryCardsDecision` ~2191 |
| `ACTION_CHOICE` | `blueprintId[]`, `actionId[]`, `actionText[]` | one `actionId` | `actionChoiceDecision` ~2834 |
| `CARD_ACTION_CHOICE` | `cardId[]`, `blueprintId[]` (`"inPlay"` = a card on the table or in hand, otherwise a "virtual" card from elsewhere, such as the discard pile), `actionId[]`, `actionText[]` | `""` to pass, or one `actionId`. A card can have several actions: let the player choose. | `cardActionChoiceDecision` ~2316 |
| `CARD_SELECTION` | `min`, `max`, `cardId[]` (cards on the table) | selected card ids, comma-separated | `cardSelectionDecision` ~2932 |
| `ASSIGN_MINIONS` | `freeCharacters[]`, `minions[]` | per free character `"charId minionId minionId"`, joined with commas, in the order of `freeCharacters`. Warn if a minion is left unassigned. | `assignMinionsDecision` ~3010 |

Desktop settings worth copying later (Phase 3): auto-pass phases, auto-accept, always use a drop-down, and
auto-dismiss your own deck reveal.

### Planned design

- `gameMobile.js` `processXml` currently **stops polling** while a decision is pending; that stays. Add `answer(value)`, which calls `gameDecisionMade` and then `processXml`.
- New file `src/GameMobile/decisions.js`: one handler per type. Each one marks which cards are selectable and builds the decision panel in the bottom bar: text, big Done / Pass / Reset buttons, a number stepper for INTEGER, and buttons or a list for MULTIPLE_CHOICE.
- **Taps:** while a decision is pending, tapping a selectable card selects it, and a **long press (~450 ms)** opens the card details. Today a tap always opens the details (`render.js` `handleTap`). Highlight selectable cards (a gold outline) and selected ones (a stronger outline plus a check mark).
- **Hand on phones:** when the decision involves hand cards, show the hand inline above the bottom bar (like the tablet dock) instead of making the player open the sheet.
- **Cards from elsewhere** (ARBITRARY_CARDS, ACTION_CHOICE, virtual cards in CARD_ACTION_CHOICE): show them in a sheet or strip with the same tap-to-select.
- **Assign minions:** tap a minion, then tap a companion (tap the minion again to unassign). Show the pairs live in the Assignments section before sending.
- Keep `renderer.render()` as a full rebuild; keep the selection in a decision object and apply it while rendering.
- Remove the "Answer in the standard view" note once all 7 types work. Keep the menu link to the standard view.

### How to test Phase 2

- Unit-test the answer building (for example, the assignment string) in Node, like `test-state.js`.
- Live: `node autoplay.js --players qwer` plays qwer. Drive asdf on `game-mobile.html` with Playwright (phone size), tapping through the decisions. A small script that plays asdf through the mobile UI with random taps until the game ends would test every decision type.
- Run `screenshots.js` on a replay to check nothing in the read-only views broke.

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
5. **Run the tests:** `node test-state.js` (11 should pass). For screenshots, use `screenshots.js` (see `dev/README.md`).

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
