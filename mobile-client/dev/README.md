# Mobile client – development tools

Tools for building and testing the mobile client against a local server. None of this is deployed.

| File | What it does |
|---|---|
| `start-local-server.sh` | Starts a local Gemp server: MariaDB in Docker plus the Java server on port 80. It needs root, as in a Claude Code cloud session. |
| `autoplay.js` | Plays a whole game between the test users, answering every decision at random. It can save every server response as test data. |
| `test-state.js` | Tests for the mobile game state model (`src/GameMobile/state.js`), using hand-made events and the recorded game in `fixtures/`. |
| `xml.js` | Minimal XML reader shared by the scripts. |
| `fixtures/` | One recorded game: everything the server sent player `asdf` live (`game1-asdf/`), and the same game's replay. |

## Test users and decks

The database script creates the users `asdf` (password `asdf`), `qwer` (password `qwer`) and `Librarian` (password `qwer`).
`autoplay.js` expects `asdf` to have a deck called "Aragorn Starter" and `qwer` one called "Gandalf Starter"
(Fellowship Block). Both are the starter decks the bots use (`FotrStartersSimulation.java`).
To create them, log in and save them, for example with curl:

```bash
U=http://localhost/gemp-lotr-server
curl -c asdf.txt -d "login=asdf&password=asdf" $U/login
curl -b asdf.txt --data-urlencode "deckName=Aragorn Starter" --data-urlencode "targetFormat=fotr_block" \
     --data-urlencode "notes=" --data-urlencode "deckContents=<contents from FotrStartersSimulation.java>" $U/deck
```

## Common tasks

```bash
./start-local-server.sh                          # start the server (add --build after Java changes)
node autoplay.js                                 # play a game between asdf and qwer
node autoplay.js --delay 150                     # slower, to spectate it
node autoplay.js --players qwer                  # play only qwer; open the game as asdf yourself
node autoplay.js --out /tmp/game                 # save every server response
node test-state.js                               # run the state model tests
```

Pages to open once logged in, for example as `Librarian` to spectate:

- Live game: `http://localhost/gemp-lotr/game-mobile.html?gameId=<id>`
- Replay: `http://localhost/gemp-lotr/game-mobile.html?replayId=<player>$<recordingId>`. Keep the `$` as it is; don't encode it.
