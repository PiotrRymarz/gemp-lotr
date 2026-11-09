# core/table-draft: what the legacy table draft page does

Ported from `gemp-lotr-async/src/main/web/tableDraft.html`, `src/TableDraft/tableDraft.js` (layout only),
`js/gemp-022/tableDraftUi.js` and the calls in `communication.js`. Server side: `TableDraftRequestHandler` and
`TableDraftClassic.getDocument`. Shared pieces are in `core/draft` (see its README). Wording is in
`table-draft-messages.ts`.

## Opening the page

- The hall's "Go to Draft" opens `tableDraft.html?eventId=<tournament id>` for a table draft tournament in its draft
  stage, or a solo table draft (a table of bots) in deck building or deck registration. Leagues answer 404.
  `participantId` (admins acting for a player) is passed on to every call by GempHttp, as before.

## Server calls (`TableDraftApi`, all with `participantId`, none cached)

- GET `/gemp-lotr-server/tableDraft/{eventId}` (getTableDraft): the player's `<draftStatus>`:
  - `<player name hasChosen>` per seat, in table order; `<pickOrderAscending value>` (packs pass down the list when
    true; alternates with each pack; true when missing);
  - `<pickedCard blueprintId count>`: the whole drafted pool, sorted by the server (sort:cardType,culture,name);
  - `<availablePick id blueprintId [chosen="true"]>`: the pack on offer (id = blueprint; the same card can be in it
    twice; every copy of the declared card is marked); none once the draft is finished;
  - `<timeRemaining value>`: seconds left for this pick, only for a timed draft (can go below 0 until the server
    forces the picks); `<roundsInfo currentRound roundsTotal>`: the pack being drafted.
  - 404 when there is no such live draft as above. Another root was ignored (`getStatus` gives null).
- POST `/tableDraft/{eventId}` (makeTableDraftPick) with `choiceId`: declares that card for the pick; the pick is made
  once every player has declared one (bots declare at once; players who miss many picks get a random one), and the
  player may declare another card until then. Answers the `<draftStatus>` above. 404 as above or once finished; 400
  when the card is not in the pack (an unknown card is otherwise silently ignored by the server).
- The event id is put in the path as it is (not encoded), as the legacy page did.

## Page (`TableDraftService`, `TableDraftCardActions`)

- Polling: the status is asked for at once and then every 500 ms (`TABLE_DRAFT_POLL_MS`, via `IntervalTimer` in
  core/platform), from `start()` until `stop()`, the end of the draft or a failed call. The route starts it and stops
  it when it is left; the service also stops when its (route) injector is destroyed.
- Each status shows: the line above the pack (`message`): "Make a pick", or "Waiting for others to pick a card" once a
  card is declared, followed by " - Pack 1/3" and " (m:ss)" when given; "Draft is finished" once there is no pack.
  The seats as one line of names joined by `passSeparator` (" > " or " < "), each marked when it has declared
  (`player-chosen`). The pack, with the declared card marked (`chosen`, legacy `draft-highlight`). The pool below.
- The pool is not reshuffled after each pick: when exactly one copy is new it is added at the end; when the cards
  are the same nothing changes; otherwise the server's sorted pool is shown (`mergePolledPool`). Pack and seats are
  kept as they are when unchanged, so polls do not redraw them.
- Using a card of the pack declares it; using a drafted card does nothing. Card details (shift-click, right-click,
  drag up; plus the shared card's long press and ⓘ) show the card information, for both.
- Errors: a failed call stops polling and the legacy page wrote two warnings in the chat (`CONNECTION_LOST`: the table
  may have been removed or the connection lost; refresh the page or go back to the hall). No alert.
- The chat ("Draft-{eventId}" room, updated every 3 s) and its "Players(n)" tab are not part of this core: see gaps.

## Differences from the legacy page

- One poll at a time: a tick is skipped while an answer is awaited or a card is being declared (the legacy page sent
  one every 500 ms regardless). Declaring a card cancels the poll under way, so an older status cannot show after it.
- The warnings of a failed call are page state (`phase` 'lost', `notices`) for the view to show, not chat lines;
  `start()` starts again (the legacy page asked for F5).
- One declaration at a time (`picking`), only for a card in the pack, and not again for the card already declared
  (the legacy page sent it again; the server changes nothing).
- A 400 on a declaration (the pack moved on between poll and click) alerts "There was a problem during communication
  with server" and polling goes on; the legacy page stopped polling as for any error.
- A timer past its end shows 0:00 (the legacy page showed e.g. "-1:-2").
- The pool is only replaced when it really changed; a pool that lost cards (not expected) is taken from the server.
- Without `?eventId=` nothing is asked and the page says so (NO_TABLE_DRAFT_EVENT); the legacy page polled
  `/tableDraft/null`.
- The layout math (jquery.layout north/center split, layoutUI absolute positions, 200px card height, 200px chat
  column) is not ported.

## Gaps

- Chat: no chat core exists yet; the view (or a later shared chat chunk) needs the "Draft-{eventId}" room, its player
  list and the server message dialogs.
