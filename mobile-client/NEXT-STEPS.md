# Next steps for Piotr

The mobile version of Gemp is built and tested in the cloud, on emulated phones. Now it needs **your real phone**.
This page says what to do, what to check, and which decisions are waiting for you.

## 1. Get the work onto your computer

All the work is on the branch **`Piotr-Mobile`** of your repository `trymarz/gemp-lotr-private`.

- **If you already have the repository on your computer:** in its folder, run `git fetch origin` and `git checkout Piotr-Mobile`.
- **If you don't:** `git clone https://github.com/trymarz/gemp-lotr-private.git`, then `cd gemp-lotr-private` and `git checkout Piotr-Mobile`.

(Or simply ask Claude Code to do it; see the next step.)

## 2. Let Claude Code on your computer set everything up

Open Claude Code in the repository folder and type:

> Read mobile-client/LOCAL-SETUP.md and mobile-client/HANDOFF.md, then help me run Gemp on this computer and test the mobile version on my phone.

It will guide you through:

- **Docker Desktop:** installing it if you don't have it. The server runs inside it.
- **Starting the server:** it can then be opened at `http://localhost:17001/gemp-lotr/`.
- **A Cloudflare tunnel:** a free program that gives your computer a temporary **https://…trycloudflare.com** address your phone can open. HTTPS is needed so the phone can install Gemp as an app.

Things only you can do: install programs when asked, and use your phone.

## 3. What to check on your phone

Open the tunnel address with **/gemp-lotr/** at the end, in Chrome on Android. Log in as `asdf` (password `asdf`) or
with an account you register. For an opponent, log in as `qwer` (password `qwer`) in a browser on your computer, or
use "Practise against the bot" in the Play tab.

Note anything that looks wrong, is hard to tap, or confuses you, ideally with a screenshot.

**Getting in**
- [ ] The login page fits the screen and is easy to use.
- [ ] After logging in you land in the mobile game hall, not the desktop one.
- [ ] Chrome offers "Add to home screen" / "Install app", and the installed app opens Gemp without the browser bar.

**The hall**
- [ ] Create a table (Play tab), and see it under "Your games".
- [ ] When the opponent joins, the game opens by itself.
- [ ] Join a table someone else created (pick a deck), and watch a game.
- [ ] The hall chat works (Chat tab).

**Playing**
- [ ] Real card images show, and they're big enough to recognise.
- [ ] Tapping a card opens it full size; attached cards show under their card.
- [ ] Highlighted cards can be chosen by tapping; Done, Pass and Reset do what you expect.
- [ ] Assigning minions (tap a minion, then a companion) is clear.
- [ ] Turning the phone (portrait and landscape) keeps everything usable.
- [ ] Your hand, the game log, the chat and the menu (☰) open and close easily.
- [ ] The clocks count down, and you notice when it's your move (title, vibration).
- [ ] Turn the screen off for a minute in the middle of a game, then on again: the game should come back by itself.
- [ ] At the end, the game-over screen shows who won, with a way back to the hall.

**Switching views**
- [ ] Menu → "Switch to the standard view" shows the desktop version, and its "📱 Mobile view" button brings you back.

**On a tablet** (if you have one): the same checks. The hand stays visible under the table, and in landscape the
game log is on the right.

Afterwards, ask Claude Code to add your findings to `mobile-client/REMARKS.md` and fix them.

## 4. Decisions waiting for you

1. **The desktop auto-pass bug.** The desktop's "auto-pass" setting has no effect today: it's saved in a way the server never receives. The fix is one line, but every desktop player would then get the phases they ticked instead of the server's default. The mobile version already works correctly. Fix the desktop too?
2. **Who puts it on the real server?** The real Gemp (play.lotrtcgpc.net) seems to be maintained by the Player's Council. To reach players, this work has to go to whoever deploys it, probably as a pull request to their repository. Is that you, or someone you'd send it to?
3. **What comes after the phone test?** Options from the plan:
   - fixes and polish from your phone test (recommended first)
   - drag and drop
   - swiping between parts of the table
   - a mobile deck builder (today it opens the desktop one)
   - a listing in the Google Play Store
4. **Chat.** On the cloud test server, game chat messages were sometimes lost, on the desktop game page too. Please check whether game chat works reliably on the real server today. If it does, the mobile chat should too.

## Where to read more

- [PLAN.md](PLAN.md): what was built in each phase and how it was tested.
- [REMARKS.md](REMARKS.md): your original requirements and screenshots.
- [HANDOFF.md](HANDOFF.md): notes for Claude, on any computer or in the cloud, to continue the work.
- [LOCAL-SETUP.md](LOCAL-SETUP.md): how Claude Code on your computer runs the server and the tunnel.
