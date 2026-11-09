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
