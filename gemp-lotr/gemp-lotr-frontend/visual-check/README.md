# Visual check

Two Playwright tools: `stubbed.mjs` (no server; every page, see below) and `run.mjs` (the deck builder against a
running server). `run.mjs` compares the Angular deck builder (`/gemp-lotr/ng/deckbuilder/`) with the legacy one (`/gemp-lotr/deckBuild.html`) in a
real browser (Chromium, via Playwright). Every scenario in `scenarios.mjs` runs on a fresh copy of each page. That
covers the collection filters and paging, building a deck, formats, every dialog, card information and the hover
zoom, at several window sizes. Both pages must then:

- look the same: full-page screenshots, with at most `--tolerance` pixels (default 60) differing by more than 2 colour
  levels (anti-aliasing of rounded corners and icons varies by a few pixels between two loads of the same page);
- ask the server for the same collection page and the same deck stats.

Each scenario does the same thing on both pages through `controls.mjs`: every control the scenarios use, as a pair of
selectors, the legacy page's element IDs and the Angular page's DOM contract (the `.gd-*` markup and its `data-*`
state, see the frontend README). `stubbed.mjs` uses the same file. The Angular page asks its questions in its own
dialogs (`gd-notifier`) rather than the browser's; the check answers both from the scenario's `answers`.

It writes `report/index.html` (screenshots of both pages and the differences in red) and exits with 1 if anything
differs. It is not part of the Maven build: run it by hand after changing the deck builder or the legacy files it uses.

## Running it

Needs a running Gemp server that serves the current build of the Angular page (rebuild with Maven or `ng build`, then
restart the server: it caches static files). Use a test server and a test player: the check saves a deck called
"Visual check deck" for that player, which the deck list scenarios open.

```
cd gemp-lotr/gemp-lotr-frontend/visual-check
npm ci
npx playwright install chromium
GEMP_USER=tester GEMP_PASSWORD=secret npm run check -- --server http://localhost:17001
GEMP_USER=tester GEMP_PASSWORD=secret npm run check -- --theme=modern --only start,deck-list --sizes 1366x768
```

The legacy page is the classic look, so with `--theme=classic` (the default) both pages should match; with
`--theme=modern` the screenshots are expected to differ and the report is for looking at them side by side, while
the server requests must still be the same.

| Option                  | Default                                                   |                                                                                             |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `--server`              | `$GEMP_SERVER` or `http://localhost:17001`                | The Gemp server                                                                             |
| `--theme`               | `classic`                                                 | The Angular page's theme, `classic` or `modern` (its `?theme=`, unless `--angular` has one) |
| `--legacy`, `--angular` | `/gemp-lotr/deckBuild.html`, `/gemp-lotr/ng/deckbuilder/` | The two pages' paths                                                                        |
| `--sizes`               | `1280x800,1366x768,1920x1080`                             | Window sizes                                                                                |
| `--only`                | all                                                       | Comma-separated scenario names                                                              |
| `--mutating`            | off                                                       | Also run the scenarios that change the account (saving, renaming and copying decks)         |
| `--workers`             | 4                                                         | Scenarios run in parallel                                                                   |
| `--tolerance`           | 60                                                        | Differing pixels allowed                                                                    |
| `--out`                 | `report`                                                  | Report folder                                                                               |

For a fuller check, give the test player a few packs and a selection pack in "My cards" ("my-cards" and "selection-pack"
show them), and have some library decks (decks of the "Librarian" player, for "open-library-deck").

## Things to know

- **One login for all pages.** The check logs the player in once and shares that session. Logging the same player in
  several times at once can hang the whole server: `DbPlayerDAO.loginUser` holds a database connection while
  `doesPlayerHaveTrophies` asks the pool for another, so enough simultaneous logins take every connection and wait
  forever (found while building this check; it is a server bug, not a deck builder one).
- **Collection answers in order.** The legacy page showed whichever collection answer arrived last, so an older request
  answered late replaced the newer page (fixed in the Angular page, which keeps only the newest). The check delivers
  collection answers in request order on both pages, so the comparison doesn't depend on the server's timing.
- **Fixed legacy bugs are not compared.** The scenarios avoid the few states where the Angular page differs on purpose
  because a legacy bug was fixed (listed in the deck builder's issue, e.g. stale collection counts after "New deck", or
  a disabled button left highlighted). Opening packs is not part of the check: it uses up the test player's packs, and
  each page would open a different one.
- **Not covered:** the Race to Mount Doom slot (needs a running RTMD league with the test player in it).

## Without a server: `stubbed.mjs`

`stubbed.mjs` screenshots each legacy page and its Angular page side by side with no Gemp server: both are served from
disk (the legacy web root and the Angular build output) and the server's answers are stubbed. Card images are replaced
by labelled placeholders on both pages. It compares nothing by itself; look at the pairs in `report-stubbed/`, or
compare two runs (below). A scenario that fails (e.g. a selector times out, `--timeout` ms per step) is reported at the
end and the script exits with 1; the other scenarios still run.

```
npm run build                      # in gemp-lotr-frontend
cd visual-check && node stubbed.mjs                                   # every page, classic theme, 1440x900
node stubbed.mjs --page deckbuilder --scenario deck,settings --viewport 1440x900,1280x800
node stubbed.mjs --theme modern --touch --viewport phone             # the modern theme on a phone
node stubbed.mjs --theme modern --touch --viewport tablet --out report-tablet
```

| Option                   | Default          |                                                                                                             |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `--page`                 | all              | Comma-separated page names (`pages/index.mjs`)                                                              |
| `--scenario` (`--only`)  | all              | Comma-separated scenario names                                                                              |
| `--theme`                | `classic`        | The Angular page's `?theme=`, unless `--angular` names one                                                  |
| `--angular`              | the page's route | A path (`/gemp-lotr/ng/deckbuilder/?theme=modern`) replaces the page's; a query (`?x=1`) is added           |
| `--legacy`               | the page's       | The legacy page's path                                                                                      |
| `--viewport` (`--sizes`) | `desktop`        | Comma-separated `WxH` or presets: `desktop` 1440x900, `laptop` 1280x800, `phone` 390x844, `tablet` 820x1180 |
| `--touch`                | off              | Emulates a touch screen (`pointer: coarse`), for `phone` and `tablet`                                       |
| `--color-scheme`         | `light`          | `prefers-color-scheme` as emulated: `light` or `dark` (the modern theme's two palettes)                     |
| `--out`                  | `report-stubbed` | Output folder (emptied first)                                                                               |
| `--timeout`              | 10000            | Milliseconds a step may wait for an element                                                                 |

Screenshots are named `<page>-<scenario>-<size>-{legacy,angular}.png`; the deck builder's keep their first names,
without `deckbuilder-`.

### Deck builder scenarios

`collection`, `second-page`, `shadow-filter`, `deck` (a few cards, copies and sites in the deck, with the stubbed
stats), `zoom-deck` and `zoom-collection` (the hover zoom), `card-info`, and the dialogs: `deck-list`, `library`,
`import`, `import-typed`, `notes`, `selection` (the selection pack's "Choose one"), `delivery` ("New items", from a
stubbed pack delivery), `confirm` and `prompt` (deleting and renaming a deck; the legacy page used the browser's own
dialogs, which screenshots don't show, so its side shows only the page behind). Angular only (the legacy side shows
the page as loaded): `settings` (the settings dialog, from the toolbar or the shell header), `menu-open` (the shell's
`gd-menu`, where the theme shows it), `pane-collection`, `pane-deck` and `info-button` (the tab bar and the cards' ⓘ,
for a theme that shows them). Where the theme shows one pane at a time (modern, phone and tablet), the scenarios that
use the collection first choose it in the tab bar (`.gd-page__tab[data-pane=collection]`).

### Login page scenarios

`/gemp-lotr/index.html` against `/gemp-lotr/ng/login` (the status line from `server-status.txt`, `/login` and
`/register` answered OK unless the scenario says otherwise): `initial`, `register` (the register form), `error` (a
wrong password: 401) and `busy` (the login call never answered; Angular only, as the legacy login call was synchronous
and froze the page until the answer). In classic, `initial` and `register` match the legacy page exactly; in `error`
the password field's border is the browser's hover border, as the mouse rests on its `label` (the legacy text was no
label).

### Merchant scenarios

`/gemp-lotr/merchant.html` against `/gemp-lotr/ng/merchant` (GET `/merchant` answered from a stubbed stock of a
pack and 41 cards in `pages/merchant.mjs`, paged and filtered by the request; the operations answer OK): `initial`,
`filtered` (a card name typed: a short page of cards in one row), `page-2`, `confirm` ("Sell for" on the first card:
the "Merchant operation" dialog), `error` (GET `/merchant` answers 500) and, Angular only in the modern theme on a
phone (under 768px), `filters-open` (the filter's details unfolded with `.gd-merchant-filter__toggle`). In classic, `initial`, `filtered`,
`page-2` match the legacy page exactly, and `confirm` but for the focus ring around the dialog's Wiki link. In `error` the legacy page used the browser's alert, which a
screenshot doesn't show; the Angular side shows the notifier's dialog over an empty page.

### Adding a page

Add `pages/<name>.mjs` and list it in `pages/index.mjs`. It exports by default:

```js
export default {
  name: 'merchant', // for --page and the screenshots' names
  legacy: '/gemp-lotr/merchant.html', // null: no legacy page (only the Angular side is shot)
  angular: '/gemp-lotr/ng/merchant/', // the app route; ?theme= is added
  answer(path, url, request, scenario) {
    // a /gemp-lotr-server/<path> request (path without that prefix)
    if (path === '/player') return { file: 'player.json', type: 'application/json' }; // from src/testing/server-responses
    if (path === '/merchant/list') return { xml: '<?xml ...?>' }; // or { json }, or { status: 404 }
    return null; // 404, logged as unanswered
  },
  skip: (scenario, mode) => false, // optional: a reason to skip (mode: { theme, touch, width, height })
  scenarios: [
    { name: 'loaded', act: async () => {} },
    {
      name: 'sell',
      act: (page, which) => page.click(which === 'legacy' ? '#sell' : '.gd-merchant [data-action=sell]'),
    },
    { name: 'menu-open', angularOnly: true, act: openMenu }, // legacy side shown as loaded
    { name: 'empty', answers: { '/merchant/list': { xml: '...' } }, act: async () => {} }, // its own answers first
    { name: 'wide-only', skip: (mode) => mode.touch && 'not on touch screens', act: async () => {} },
    // An answer that never comes ({ hang: true }) keeps the page busy; `pending` skips waiting for the network to idle
    { name: 'busy', pending: true, answers: { '/login': { hang: true } }, act: async () => {} },
  ],
};
```

Each scenario runs on a freshly loaded page, once per side (`which` is `legacy` or `angular`); put shared selector
pairs in `controls.mjs`. `lib/steps.mjs` has steps any page can use: `settle`, `hover`, `showPane` (the tab bar, where
shown) and `openMenu`. `lib/stub-server.mjs` serves the files and the answers.

### Comparing two runs: `compare.mjs`

```
node compare.mjs report-before report-after [--threshold 2] [--tolerance 0]
node stubbed.mjs --compare report-before report-after     # the same
```

For each PNG in either folder, prints the number of pixels where some channel differs by more than `--threshold`
levels (default 2) and their bounding box (`left,top to right,bottom (WxH)`), or "same", a size mismatch or a file on
one side only. Exits with 1 if a file has more than `--tolerance` such pixels. Use it to check that a change leaves the
screenshots alone (run before and after into two folders), or to compare the classic theme with the legacy side.
Two runs of the same build can differ by a few pixels of a few levels (anti-aliasing).

Playwright comes from `visual-check/node_modules` (`npm ci`). Where it is only installed globally, as in some
containers, make it resolvable with `npm link playwright` in `visual-check` (it must find a browser for that version; a
global install usually brings its own).
