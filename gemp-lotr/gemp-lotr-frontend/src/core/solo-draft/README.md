# core/solo-draft: what the legacy solo draft page does

Ported from `gemp-lotr-async/src/main/web/soloDraft.html`, `src/SoloDraft/soloDraft.js` (layout only),
`js/gemp-022/soloDraftUi.js` and the calls in `communication.js`. Server side: `SoloDraftRequestHandler` and
`CollectionRequestHandler`. Shared pieces are in `core/draft` (see its README). Wording is in
`solo-draft-messages.ts`.

## Opening the page

- The hall's "Go to Draft" (solo draft tournaments in deck building, registering decks or awaiting kickoff) and the
  league page open `soloDraft.html?eventId=<tournament id or league code>` in a new tab. `participantId` (admins acting
  for a player) is passed on to every call by GempHttp, as getUrlParam("participantId") did.
- There is no other parameter, no filter and no sorting control on the page.

## Server calls (`SoloDraftApi`, all with `participantId`, none cached)

- GET `/gemp-lotr-server/soloDraft/{eventId}` (getDraft): `<availablePicks>` with one `<availablePick id
[blueprintId] [url]>` per choice, in server order; none once the draft is finished. Card choices have the blueprint
  as id; picture choices (singleCollectionPick definitions) only an id and a `url`. 404 when the event is not a live
  solo draft league that has started, nor a solo draft tournament in deck building or deck registration.
- POST `/soloDraft/{eventId}` (makeDraftPick) with `choiceId`: `<pickResult>` with the `<pickedCard blueprintId
count>`s the pick gave and, unless it was the last pick, the next `<availablePick>`s. 404 as above or when the draft
  is already finished; 400 when the choice is not on offer.
- GET `/collection/{eventId}` (getCollection) with `filter=sort:cardType,culture,name`, `start=0`, `count=1000`: the
  cards drafted so far (`<collection>` of `<card blueprintId count>`), sorted by the server.
- The event id is put in the path as it is (not encoded), as the legacy page did: the server reads the raw path.
- Failed calls are an `ApiError`. A pick answered with another root is one too (`INVALID_RESPONSE_STATUS`).

## Page (`SoloDraftService`, `SoloDraftCardActions`)

- On load: both GETs; the picks show above with "Make a pick", or "Draft is finished" when there are none. The drafted
  cards show below, one card per copy (`draftedCopies`), in server order.
- Using a pick on offer makes it: the picks go away at once, then the picked cards are added after the drafted ones
  (not re-sorted) and the next picks show, or "Draft is finished". Using a drafted card does nothing.
- Card details (shift-click, right-click, drag up; plus the shared card's long press and ⓘ) show the card information,
  for picks and drafted cards alike.
- No polling: a solo draft only changes when the player picks.
- Errors: any failed call alerts "There was a problem during communication with server" (processError; aborted
  requests were ignored, here older loads are simply dropped).

## Differences from the legacy page

- Both GETs are made together and shown together (`status` 'loading' until then); one alert when either fails
  (`status` 'failed'), instead of one per call.
- A failed pick alerts, then loads the draft again; the legacy page removed the picks and was left without any.
- One pick at a time (`picking`), and only for a choice on offer.
- Without `?eventId=` nothing is asked and the page says so (NO_DRAFT_EVENT); the legacy page asked for
  `/soloDraft/null`.
- A pick shown by a picture keeps its choice in its card ref (`draftChoice`), so its details can show the picture;
  the legacy page showed the "rules" card there.
- The layout math (jquery.layout north/center split, layoutUI absolute positions, 200px card height) is not ported.
