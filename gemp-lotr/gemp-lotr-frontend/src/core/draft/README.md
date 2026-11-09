# core/draft: what the solo draft and the table draft share

Both legacy pages (`soloDraftUi.js`, `tableDraftUi.js`) show the picks on offer above the cards drafted so far, and
both servers (SoloDraftRequestHandler, TableDraftRequestHandler) write the same elements for them. What only one page
does lives in `core/solo-draft` (and, next, `core/table-draft`).

- `draft-models.ts`: `DraftChoice` (`<availablePick id [blueprintId] [url]>`: a card, or a set of cards shown by a
  picture), `DraftedCard` (`<pickedCard blueprintId count>`, or a `<card>` of the draft collection) and `PickResult`.
  The table draft adds its own fields (e.g. `chosen`, timers, players) in its own models.
- `draft-parsers.ts`: `parseDraftChoices` and `parsePickedCards` read those children of any answer root (the solo
  draft's `availablePicks` / `pickResult`, the table draft's `draftStatus`); `draftedCardsOf` takes the cards of a
  draft collection page (GET /collection/{eventId}).
- `drafted-pool.ts`: the drafted pool, in display order: `addPicked` (picks come after what was drafted, as the legacy
  pages appended them), `draftedCopies` (one entry per copy, the legacy pages drew a card per copy), `poolCounts` and
  `poolSize`; `choiceBlueprintId` draws a picture pick as the "rules" card, as the legacy pages did.
- Card refs (`core/cards/card-ref.ts`): `draftChoice` (a pick on offer, zone "picks") and `drafted` (a drafted copy,
  zone "drafted"). Each page provides its own `CARD_ACTIONS` (`SoloDraftCardActions`).
- Deck builder hand-off: neither legacy draft page links to the deck builder. The drafted cards are the event's
  collection (collection type = the event id, listed by GET /collection), which the deck builder already offers as a
  format; a link from the draft page, if wanted, is for the view (3b) and needs nothing more from core.
