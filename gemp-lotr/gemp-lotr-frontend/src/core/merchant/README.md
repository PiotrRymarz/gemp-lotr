# core/merchant: what the legacy merchant page does

Ported from `gemp-lotr-async/src/main/web/merchant.html`, `src/Merchant/merchant.js` (layout only),
`js/gemp-022/merchantUi.js`, the `LegacyCardFilter` in `js/gemp-022/cardFilter.js` (not the deck builder's
`cards/CardFilter.js`), `formatPrice` in `common.js` and the calls in `communication.js`. Server side:
`MerchantRequestHandler` and `MerchantService` (gemp-lotr-server). Wording is in `merchant-messages.ts`.

## Server calls (`MerchantApi`, all with `participantId`, added by GempHttp)

- GET `/gemp-lotr-server/merchant` (getMerchant, not cached) with `filter`, `ownedMin`, `start`, `count`. Answers
  `<merchant currency="silver" count="total">` with one `<card>` (blueprint contains `_`) or `<pack>` per item of the
  page, in server (filter/sort) order, each with `blueprintId`, `count` (copies in "My cards"), and when they apply
  `buyPrice` (what the merchant pays; only for owned items), `sellPrice` (what it asks; only for what it sells) and
  `tradeFoil="true"` (4+ copies of a non-foil card). `ownedMin` 0 lists everything the merchant sells plus the
  player's cards; above 0 only the player's items with at least that many copies. → `MerchantPage`
  (`parseMerchantPage`; any other root is an empty page).
- POST `/merchant/buy` (buyItem) with `blueprintId`, `price` (the item's sellPrice): the player buys one copy.
- POST `/merchant/sell` (sellItem) with `blueprintId`, `price` (the item's buyPrice): the player sells one copy.
- POST `/merchant/tradeFoil` (tradeInFoil) with `blueprintId`: 4 copies and 4G (400 silver) for one foil (`id*`).
- The three POSTs answer `OK` (as HTML), or, when MerchantService throws, still status 200 with
  `<error message="..."/>` (e.g. "Unable to remove required currency from your collection", "Unable to remove the
  sold card from your collection", "Unable to trade in this type of item", "Unable to remove the required cards or
  currency from your collection"). → `MerchantRefusedError` (`merchantRefusal`). A failed call (401 not logged in,
  500, network) is an `ApiError`. The handler sets no delivery headers.

## Page (`MerchantService`, `merchant-filter.ts`, `merchant-cards.ts`)

- On load: cards of all sets, 18 per page, from the start: filter `product:card set:0-34,50-200,404`, ownedMin 0.
  (The legacy page asked twice at startup, `setFilter` then `getCollection`; once here.)
- Filter (LegacyCardFilter): Set (with disabled separator lines), Card name (each space-separated word becomes
  ` name:word`, empty words too), Sort, Rarity, the culture buttons (16, plus 6 Hobbit ones shown only when the set's
  value mentions 30-33; hiding them unselects them), Card type, Keyword, Type (product: packs, cards, foils, ...),
  and Race / Item class / Phase, shown only for characters / items / events (hiding one clears it). The option lists
  are the legacy ones, verified against cardFilter.js by the spec (the CROW race is labelled "Warg", as before).
  Filter string: `buildMerchantFilter`, the exact legacy concatenation (spaces included; cultures in button order).
  Any filter change goes back to the first page. The name input applies on change (Enter or leaving it).
- Paging: previous / next by the page size, and the page size slider (4-40, starts at 18, enabled after the first
  page; moving it goes back to the first page). Previous is disabled on the first page, next on the last; both
  after a click on either, until the new page arrives.
- "Owned >=" 0-5 (`ownedMin`) and "Hide merchant" reload the current page (start kept), as the legacy page did.
- Pocket: the player's currency from the page's `currency` (`currency()`), drawn as `formatPrice`: gold
  (floor of silver / 100) and two-digit silver, with the gold and silver coin images (`priceParts`).
- Each card shows the copies owned (0 included; packs have no border, foils the foil layer, errata the marker) and,
  unless "Hide merchant": "Sell for <price>" (buyPrice), "Buy for <price>" (sellPrice; disabled and red when it costs
  more than the currency) and "Trade 4 for foil" (`MerchantCard`). Packs come first, then cards, in server order.
- Using a card does nothing; its details (shift-click, right-click, drag up; plus the shared card's long press and ⓘ)
  show the card information (`MerchantCardActions`, provided as `CARD_ACTIONS`).
- Each operation asks first, in the "Merchant operation" dialog (legacy: the card beside the question, Yes / No):
  "Do you want to sell this item for P?", "Do you want to buy this item for P?", "Do you want to trade 4 of this card
  and 4G in currency for a foil version of the card?". Yes runs it, then the current page is reloaded. Here the
  question goes through `Notifier.confirm`, with the price as text ("12G 05S"); `question()` says which item it is
  about so the view can show the card beside it. The merchant's route provides its own Notifier
  (`ui/merchant/MerchantNotifier`), which asks in the page's "Merchant operation" dialog, drawing the price from
  `questionWording` and `priceParts`; messages still go to the app's notifier.
- Errors: a page that fails to load, or a failed operation call, alerts "There was a problem during communication
  with server" (processError; the legacy page ignored aborted requests, here older requests are simply dropped).

## Differences from the legacy page

- A refused operation shows the merchant's message (or MERCHANT_REFUSED when it has none) before the reload; the
  legacy page parsed the answer as HTML, ignored it and just reloaded. A failed call is not followed by a reload.
- One operation at a time (`busy()`): no second question while one is open or a call is under way.
- Only the newest page request is shown, once its images have loaded (as in the deck builder).
- The layout math of merchant.js / layoutUI (absolute positions, minimum 800x400) is not ported; the themes lay out.
