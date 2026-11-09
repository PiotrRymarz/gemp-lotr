# Gemp server responses used by the unit tests

- Captured from a real server (this branch, fresh database) on 2026-11-01:
  `deck.xml`, `deck-missing.xml`, `deck-list.xml`, `collection-default.xml`, `convert.xml`, `stats.html`.
  The deck was saved with the name `Test + deck & co` and notes containing `+` and `&`, to check encoding.
- Written by hand from the server code, because a fresh database has no leagues, packs or limited collections:
  `collection-with-packs.xml` (CollectionRequestHandler.getCollection), `collection-types.xml`
  (CollectionRequestHandler.getCollectionTypes), `leagues.xml` (LeagueRequestHandler, league list) and
  `pack-delivery.xml` (DeliveryRequestHandler.serializeCollectionsAsXML).
- `player.json`: GET /player (PlayerInfoRequestHandler, `Player.GetUserInfo` serialized by `JsonUtils.Serialize`),
  written by hand from the server code, for a player with trophies.
- Written by hand from the server code, for the login page: `login-ok.xml` (the body of a successful POST /login or
  /register: `writeXmlResponse(null, ...)` in GempukkuHttpRequestHandler writes `<result>OK</result>`; a 202 or an
  error has an empty body) and `server-status.txt` (GET /, StatusRequestHandler, with made-up counts).
- Written by hand from the server code, for the merchant: `merchant.xml` (GET /merchant,
  MerchantRequestHandler.getMerchantOffers: `<merchant currency count>` with `<card>`/`<pack>` items in server order,
  `buyPrice` only for owned items, `tradeFoil="true"` for 4+ non-foil copies), `merchant-ok.txt` (the body of a
  successful POST /merchant/buy, /sell or /tradeFoil) and `merchant-error.xml` (what those calls answer, still with
  status 200, when the operation fails: `marshalException`).
- Written by hand from the server code, for the solo draft (a fresh database has no solo draft league or tournament):
  `solo-draft-picks.xml`, `solo-draft-picture-picks.xml` and `solo-draft-finished.xml` (GET /soloDraft/{eventId},
  SoloDraftRequestHandler.getAvailablePicks: `<availablePicks>` with one `<availablePick id [blueprintId] [url]>` per
  choice, none once finished; card choices use the blueprint as id, picture choices (singleCollectionPick) have only
  a `url`, made up here), `solo-draft-pick-result.xml` and `solo-draft-last-pick-result.xml` (POST /soloDraft/{eventId},
  makePick: `<pickResult>` with the `<pickedCard blueprintId count>` given and, unless it was the last pick, the next
  `<availablePick>`s) and `solo-draft-collection.xml` (GET /collection/{eventId}, the drafted cards, as
  CollectionRequestHandler.getCollection writes them).
- Written by hand from the server code, for the table draft (a fresh database has no table draft tournament):
  `table-draft-status.xml`, `table-draft-chosen.xml`, `table-draft-next-pick.xml` and `table-draft-finished.xml`
  (GET and POST /tableDraft/{eventId}, TableDraftRequestHandler writing TableDraftClassic.getDocument: `<draftStatus>`
  with a `<player name hasChosen>` per seat in table order, `<pickOrderAscending value>`, the drafted pool as
  `<pickedCard blueprintId count>`s sorted by the server, the pack on offer as `<availablePick id blueprintId
[chosen="true"]>` (the same card may be on offer twice), `<timeRemaining value>` (seconds) only for a timed draft,
  and `<roundsInfo currentRound roundsTotal>`). Players and cards are made up.
- Written by hand from the server code, for the hall (a fresh database has no tables or queues): `hall.xml` (GET
  /hall, HallRequestHandler.getHall with SerializeHallInfoVisitor: `<hall channelNumber currency motd serverTime
serverTimeMs>` with `add` queue, tournament and table rows and a `<newGame>`; attributes from
  HallServer.processHall, values made up), `hall-update.xml` (POST /hall/update: `update` / `remove` rows, `shutdown`,
  two `<newGame>`s, one already announced) and `hall-update-empty.xml` (an update with no changes).
- Written by hand from the server code, for the hall chat: `chat.xml` (GET /chat/Game%20Hall,
  ChatRequestHandler.serializeChatRoomData: `<chat roomName>` with `<message from date>` holding server markup
  (MarkdownParser output for players), and the `<user>` list with the viewer's own entry first (`self`,
  `incognito`), a `role`, and an old-style "+ " prefix), `chat-update.xml` (a poll's answer) and, for
  PlayerInfoRequestHandler, `ignores.json` (GET /player/ignores) and `ignore-added.json` (POST /player/ignores/add).
