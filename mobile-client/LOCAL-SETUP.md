# Running Gemp on Piotr's computer and testing the mobile client on his phone

Instructions for the Claude Code agent on Piotr's own computer. Piotr is not a web developer: explain each step in
plain words, run commands for him where you can, and tell him clearly when he has to do something himself (install a
program, open something on his phone).

**Read these first:** [HANDOFF.md](HANDOFF.md) for the state of the work, and the decisions already made.
[PLAN.md](PLAN.md) for the details of each phase. [dev/README.md](dev/README.md) for the test tools.

## Where things stand

- All work is on branch **`Piotr-Mobile`** of `trymarz/gemp-lotr-private`. Phases 0–4 of the mobile client are done and were tested in a cloud sandbox: a local server, emulated phones in Playwright, and placeholder card images.
- What has **never** been tried:
  - a real phone
  - real card images (the sandbox blocked `i.lotrtcgpc.net`)
  - installing the app (PWA) on Android
  - the game chat on a server other than the sandbox's
- **That is the goal now:** run Gemp on Piotr's computer, make it reachable from his phone over **HTTPS** (needed to install a PWA and for its service worker), and go through the checklist below with him.

## 1. Get the code

```bash
git clone https://github.com/trymarz/gemp-lotr-private.git   # or use the existing clone
cd gemp-lotr-private
git fetch origin Piotr-Mobile
git checkout Piotr-Mobile
git pull
```

Check which system Piotr uses (Windows, macOS or Linux) before the next steps. On Windows, prefer running the commands
in PowerShell, or inside WSL if it's installed.

## 2. Run the server with Docker

The repository has a Docker setup: `gemp-lotr/docker/`, explained in `gemp-lotr/docker/readme.md`. It runs two
containers: MariaDB with the Gemp database and the test users, and the Java server.

1. **Docker:** Piotr needs **Docker Desktop**. On Windows, choose WSL2 when installing. Check with `docker --version` and `docker compose version`.
2. **Before the first start:** create the log file the setup expects. Otherwise Docker creates a *folder* with that name:
   - Linux/macOS: `touch logs/nohup.out`
   - Windows PowerShell: `New-Item logs/nohup.out -ItemType File`
3. **Start the containers:** `cd gemp-lotr/docker`, then `docker compose up -d`. The first time takes several minutes.
4. **Build the server once** (the app container runs `gemp-lotr-async/target/web.jar`, which doesn't exist yet). Either:
   - **inside the container**, as `docker/readme.md` describes: `docker exec -it gemp_app_1 bash`, then `cd /etc/gemp-lotr` and `mvn install -DskipTests` (5–10 minutes), then `exit`; or
   - **on the computer itself**, if it has Java 21 and Maven 3.9: run `mvn install -DskipTests` in `gemp-lotr/`. The folder is shared with the container, so the container sees the result.

   Then restart: `docker compose restart`.
5. **Check:** open <http://localhost:17001/gemp-lotr/> in a browser on the computer. The login page should appear. The test users are `asdf` / `asdf` and `qwer` / `qwer`; Piotr can also register a new account.

Notes:

- The web files (`gemp-lotr-async/src/main/web`) are shared with the container, so changes to the mobile pages show after a browser reload, with no rebuild. Java changes need step 4 again.
- **If something fails:**
  - logs: `docker logs gemp_app_1`, `docker logs gemp_db_1` and the file `logs/nohup.out`
  - running containers: `docker ps`
- The ports come from `gemp-lotr/docker/.env`: the app on **17001**, the database on 35001.
- Test decks for `asdf` and `qwer`: run `node mobile-client/dev/setup-decks.js --base http://localhost:17001` (needs Node 18 or later). They're needed for the dev scripts (`autoplay.js`), not for playing by hand.

## 3. Reach it from the phone over HTTPS

The simplest free option is a **Cloudflare quick tunnel**: no account, no router settings.

1. Install `cloudflared`:
   - Windows: `winget install --id Cloudflare.cloudflared`
   - macOS: `brew install cloudflared`
   - Linux: see Cloudflare's docs
2. Run `cloudflared tunnel --url http://localhost:17001` and keep it running. It prints an address like `https://something-random.trycloudflare.com`.
3. On the phone, open **`https://something-random.trycloudflare.com/gemp-lotr/`**. Don't forget `/gemp-lotr/` at the end.

The address changes each time the tunnel starts, and it only works while the computer and the tunnel are on. That's
fine for testing. For a permanent test server see PLAN.md section 7.

An alternative without a tunnel, on the same Wi-Fi: open `http://<computer's IP>:17001/gemp-lotr/` on the phone. The
pages work, but **without HTTPS the app can't be installed** and the service worker doesn't run.

## 4. Test on the phone with Piotr

Go through [NEXT-STEPS.md](NEXT-STEPS.md), section "What to check on your phone", together with him. For a second player:

- **qwer in a browser on the computer:** log in as `qwer` in a desktop browser on the same server, so Piotr can play phone against desktop, which is the real goal; or
- **the bot:** the mobile hall's Play tab has "Practise against the bot".

Write down everything that looks wrong or feels awkward, with screenshots from the phone if he can send them. Add his
findings to `mobile-client/REMARKS.md` under a new heading "Phone test findings".

## 5. Then: fix and continue

- **Fixing:** for each finding, find the cause in `src/GameMobile/` (game screen), `src/HallMobile/` (hall) or `js/gemp-022/mobileView.js` (the switch), fix it, and check it on the phone again (a reload is enough for web files).
- **Tests to rerun after changes:** in `mobile-client/dev`, run `node test-state.js`, `node test-decisions.js` and `node test-hall.js`. These need only Node.
- **The browser checks** (`mobile-player.js`, `mobile-features.js`, `mobile-hall.js`, `screenshots.js`) need Playwright (`npm install playwright`, then `npx playwright install chromium`). They assume the server is at `http://localhost`, port 80; on this computer it's `http://localhost:17001`, so adjust the `BASE` constants or add a `--base` option first.
- **Saving the work:** commit and push to `Piotr-Mobile` after each meaningful step, with clear messages, and keep HANDOFF.md up to date.
- **After the phone test:** ask Piotr what comes next. The options are in HANDOFF.md under "Next step" (Phase 5 polish, the deck builder on mobile, a Play Store listing) and in NEXT-STEPS.md under "Decisions waiting for you".

## Known issues to keep in mind

- **Chat in the cloud sandbox** often lost messages while a game page was open, on the desktop game page too. Check whether chat works reliably on this computer's server and on the real one.
- **The desktop auto-pass setting has no effect** (its cookie never reaches the server; details in HANDOFF.md). The mobile settings work around it. Fixing the desktop is Piotr's decision.
- **Production:** it isn't known yet who deploys the real server (play.lotrtcgpc.net). The code says it's maintained by the Player's Council; ask Piotr. Getting this work there is his decision. Don't push anywhere other than `trymarz/gemp-lotr-private`.
