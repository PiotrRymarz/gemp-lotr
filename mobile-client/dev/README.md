# Mobile client – development tools

Tools for building and testing the mobile client against a local server. None of this is deployed.

| File | What it does |
|---|---|
| `start-local-server.sh` | Starts a local Gemp server: MariaDB in Docker plus the Java server on port 80. It needs root, as in a Claude Code cloud session. |
| `autoplay.js` | Plays a whole game between the test users, answering every decision at random. It can save every server response as test data. |
| `test-state.js` | Tests for the mobile game state model (`src/GameMobile/state.js`), using hand-made events and the recorded game in `fixtures/`. |
| `test-decisions.js` | Tests for answering decisions (`src/GameMobile/decisions.js`): the taps, the buttons and the answer of each decision type. |
| `mobile-player.js` | Plays asdf's whole game through the mobile page in a phone or tablet browser, tapping cards and buttons with random choices. Run it while `autoplay.js --players qwer` plays the other side. It fails on script errors or if the page gets stuck. |
| `setup-decks.js` | Saves the two decks `autoplay.js` needs. Run it once on a fresh database. |
| `screenshots.js` | Opens a replay on the mobile screen at phone and tablet sizes (portrait and landscape) and takes screenshots at key moments. It also reports script errors and sideways page overflow. |
| `xml.js` | Minimal XML reader shared by the scripts. |
| `fixtures/` | One recorded game: everything the server sent player `asdf` live (`game1-asdf/`), and the same game's replay. |

## Test users and decks

The database script creates the users `asdf` (password `asdf`), `qwer` (password `qwer`) and `Librarian` (password `qwer`).
`autoplay.js` expects `asdf` to have a deck called "Aragorn Starter" and `qwer` one called "Gandalf Starter"
(Fellowship Block). Both are the starter decks the bots use (`FotrStartersSimulation.java`).
On a fresh database, create them with `node setup-decks.js`.

## Common tasks

```bash
./start-local-server.sh                          # start the server (add --build after Java changes)
node setup-decks.js                              # once per fresh database
node autoplay.js                                 # play a game between asdf and qwer (prints the replay ids)
node autoplay.js --delay 150                     # slower, to spectate it
node autoplay.js --players qwer                  # play only qwer; open the game as asdf yourself
node autoplay.js --out /tmp/game                 # save every server response
node test-state.js                               # run the state model tests
node test-decisions.js                           # run the decision tests
node autoplay.js --players qwer &                # then play asdf through the mobile page:
NODE_PATH=/opt/node-tools/node_modules node mobile-player.js <gameId> ["Pixel 7 landscape"] [--shots DIR]
REPLAY='asdf$<id>' OUT=/tmp/shots NODE_PATH=/opt/node-tools/node_modules node screenshots.js
```

Pages to open once logged in, for example as `Librarian` to spectate:

- Live game: `http://localhost/gemp-lotr/game-mobile.html?gameId=<id>`
- Replay: `http://localhost/gemp-lotr/game-mobile.html?replayId=<player>$<recordingId>`. Keep the `$` as it is; don't encode it.
