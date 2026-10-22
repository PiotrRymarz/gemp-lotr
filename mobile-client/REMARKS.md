# Mobile Client – Remarks & Requirements

Notes from Piotr on the planned Android (phone and tablet) client for Gemp-LotR.
This file collects the goals first. The code analysis and implementation plan come later.

## Background

- Gemp-LotR is a card game made of a Java server and a JavaScript client.
- Today the game is played mainly in a web browser.
- The current UI is designed for desktop browsers and works poorly on Android phones and tablets.

## Goal

- A new client version for Android phones and tablets.
- It talks to the **same server** as the web client, so mobile players can play against web-browser players.

## Current game screen (desktop)

![Current game screen](screenshots/current-game-desktop.webp)

Areas on the screen, roughly left to right and top to bottom:

- **Adventure path:** a column on the far left with the site cards. Player position markers (1, 2) sit on the current site.
- **Game status panel:** player names, card and token counters, and clocks. Below that the current phase (Skirmish), the twilight pool (0), the game timer and the initiative (Shadow).
- **Decision prompt:** a box in the left column, for example "Choose next skirmish to resolve".
- **Chat and controls:** bottom left, with Chat, Settings, Options and Players tabs, plus Auto-zoom and Timer toggles.
- **Opponent's area (top):** the support area row, then the opponent's companions (shown greyed out).
- **Skirmishes (middle):** minions grouped against the companions they're assigned to. The active skirmish is shown separately on the right (Gorgoroth Swarm vs. Faramir, highlighted).
- **Own area:** companions with their attached cards, then the support area row.
- **Hand (bottom):** cards in hand (Haradrim Marksman, Elite Archer).

What makes this hard on a phone:

- Many full-size cards in each row, with card text too small to read.
- Small damage, wound and burden tokens stacked on top of the cards.
- A fixed multi-column desktop layout. The side panels take space the game table needs.
- Small click targets (tabs, the "+" buttons, the cards themselves).

## Game hall screen (desktop)

![Game hall](screenshots/game-hall-desktop.png)

Areas on the screen, top to bottom:

- **Main tabs:** Game Hall, Help, Events, Server Info and My Account.
- **Link buttons:** Report a Bug, Report a Player, Join the PC Discord, Browse the LOTR-TCG Wiki and Merchant (crossed out).
- **MOTD:** the message of the day, for example a league announcement with a link.
- **Table lists:** collapsible sections for Waiting Tables, Playing Tables, Finished Tables and Recurring Events. Each table is a row with the columns Format, Table Info, Status (for example "At sites: 5, 5" or "Waiting 01:17"), Players and Actions (Join Table, Play Match or Spectate). Your own game is highlighted in red.
- **Bottom bar:** connection status, the **Deck-builder** and **Play** buttons, and the server date and time.
- **Chat:** an embedded Discord chat (WidgetBot) with channels and messages, an online players list with status badges (online, admin), and a "Switch to Legacy" button.

What makes this hard on a phone:

- The 5-column tables are too wide for a phone. The Table Info and Players text gets squeezed or forces sideways scrolling.
- The two rows of tabs and link buttons take a lot of height and wrap on a narrow screen.
- The Discord widget and the players list sit next to each other, which doesn't fit beside or under the tables on a phone.
- The important actions (Play Match, Join Table, Play, Deck-builder) are spread around the screen.

## Remarks

<!-- Add remarks below, one per bullet. Group them under headings if useful. -->

- **Screen space:** the cards are large images, and they don't fit on a phone screen. You have to drag the whole page around to see the different groups of cards.
- **Interaction:** the UI has no drag and drop. Every action takes clicks (taps), all over the screen.
- **Covered cards:** cards that sit under other cards (attached or stacked) can't be seen, so there's no way to tell what's there.
- **Layout confirmed:** the top of the game screen is the opponent's area.

- **Orientation and devices:** phones in both portrait and landscape, and tablets too.
- **Drag and drop:** tap-then-tap is enough for the first version; drag and drop later.
- **Switching views:** phones and tablets open the mobile screens automatically, with an option to go back to the standard view.
- **Game hall:** the hall screen also needs a mobile PWA version (see the "Game hall screen" section above).

## Open questions

- Test server: local in the cloud environment for development; a public HTTPS server for testing on a real phone (see PLAN.md, section 7).
