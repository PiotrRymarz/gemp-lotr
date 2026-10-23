// Plays a whole game as asdf through the mobile game screen, tapping cards and buttons like a person would
// (random choices), while autoplay.js plays qwer. Fails if the screen gets stuck or shows script errors.
//
//   node autoplay.js --players qwer &            # prints "game N started"
//   NODE_PATH=/opt/node-tools/node_modules node mobile-player.js N [device] [--shots DIR]
//
// device: a Playwright device name, "Pixel 7" by default (try "Pixel 7 landscape" or "Galaxy Tab S4").

const { chromium, devices } = require("playwright");
const fs = require("fs");

const args = process.argv.slice(2);
const GAME = args[0];
const DEVICE = args[1] && !args[1].startsWith("--") ? args[1] : "Pixel 7";
const SHOTS = args.indexOf("--shots") >= 0 ? args[args.indexOf("--shots") + 1] : null;
const BASE = "http://localhost/gemp-lotr/";
const TIMEOUT_MS = 10 * 60 * 1000;

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

// Card images are hosted elsewhere (blocked in the cloud sandbox): plain placeholders keep the layout realistic
const PLACEHOLDER = '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350"><rect width="250" height="350" rx="12" fill="#4a3d2a"/></svg>';

(async () => {
    if (!GAME)
        throw new Error("Give the game id");
    if (SHOTS)
        fs.mkdirSync(SHOTS, { recursive: true });
    const browser = await chromium.launch();
    const context = await browser.newContext(devices[DEVICE]);
    await context.route("https://i.lotrtcgpc.net/**", r => r.fulfill({ contentType: "image/svg+xml", body: PLACEHOLDER }));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));

    await page.goto(BASE);
    await page.locator("#login").fill("asdf");
    await page.locator("#password").fill("asdf");
    await page.getByText("Login", { exact: true }).click();
    await page.waitForURL(/hall\.html/);
    await page.goto(BASE + "game-mobile.html?gameId=" + GAME);

    const counts = {};
    const shotTaken = {};
    const started = Date.now();
    let lastId = null;
    let sameIdTurns = 0;

    // The card to tap for an id: a visible copy (on phones the tablet hand area is hidden, the bottom panel shows the hand)
    const cardFor = id => page.locator(`.mg-card[data-card-id="${id}"]:visible`).first();
    const button = name => page.locator(`#mg-bottom [data-action="decision:${name}"]`);

    while (Date.now() - started < TIMEOUT_MS) {
        // Wait for our decision, or the end of the game
        const info = await page.waitForFunction(() => {
            const g = window.mobileGame;
            if (!g)
                return null;
            if (g.state.ended || g.renderer.status)
                return {ended: g.state.ended, status: g.renderer.status && g.renderer.status.text};
            const d = g.renderer.decision;
            if (!d || d.sent)
                return null;
            return {
                id: d.id, type: d.type, text: d.text,
                selectable: Array.from(document.querySelectorAll(".mg-card.mg-selectable")).map(e => e.getAttribute("data-card-id")),
                minions: d.minions || null, freeCharacters: d.freeCharacters || null,
                min: d.min, max: d.max
            };
        }, null, { timeout: 120000, polling: 100 }).then(h => h.jsonValue());

        if (info.ended || info.status) {
            console.log(info.ended ? "game over" : "problem: " + info.status);
            break;
        }
        // The server numbers every decision "1", so a repeat is recognised by its type and question
        const key = info.type + "|" + info.text;
        sameIdTurns = key == lastId ? sameIdTurns + 1 : 0;
        lastId = key;
        if (sameIdTurns > 12)
            throw new Error("Stuck on: " + info.text);
        counts[info.type] = (counts[info.type] || 0) + 1;
        const selectable = [...new Set(info.selectable)];

        if (SHOTS && !shotTaken[info.type]) {
            shotTaken[info.type] = true;
            await page.screenshot({ path: `${SHOTS}/${info.type}.png` });
        }

        if (info.type == "INTEGER") {
            if (Math.random() < 0.5 && await button("inc").isEnabled())
                await button("inc").click();
            await button("done").click();
        } else if (info.type == "MULTIPLE_CHOICE") {
            const choices = await page.locator('#mg-bottom [data-action^="decision:choice:"]').all();
            await pick(choices).click();
        } else if (info.type == "CARD_SELECTION" || info.type == "ARBITRARY_CARDS") {
            const want = Math.min(selectable.length, info.min + (Math.random() < 0.3 ? 1 : 0), info.max);
            const order = selectable.sort(() => Math.random() - 0.5);
            for (let i = 0; i < want; i++)
                await cardFor(order[i]).click();
            await button("done").click();
        } else if (info.type == "ACTION_CHOICE") {
            await cardFor(pick(selectable)).click();
            await button("done").click();
        } else if (info.type == "CARD_ACTION_CHOICE") {
            if (selectable.length > 0 && Math.random() < 0.6 && sameIdTurns == 0) {
                await cardFor(pick(selectable)).click();
                const menu = page.locator('#mg-sheet:not([hidden]) [data-action^="decision-choose:"]');
                if (await menu.count() > 0)
                    await pick(await menu.all()).click();
                await button("done").click();
            } else {
                await button("pass").click();
            }
        } else if (info.type == "ASSIGN_MINIONS") {
            // At most one minion per character; the Shadow player assigns the rest
            const characters = info.freeCharacters.slice().sort(() => Math.random() - 0.5);
            if (sameIdTurns == 0) {
                for (let i = 0; i < Math.min(info.minions.length, characters.length); i++) {
                    if (Math.random() < 0.3)
                        continue;
                    await cardFor(info.minions[i]).click();
                    await cardFor(characters[i]).click();
                }
            } else {
                await button("reset").click();
            }
            await button("done").click();
            if (await button("send").count() > 0)
                await button("send").click();
        }
    }

    if (SHOTS)
        await page.screenshot({ path: `${SHOTS}/end.png` });
    console.log("decisions answered:", JSON.stringify(counts));
    console.log("script errors:", errors.length ? errors : "none");
    await browser.close();
    if (errors.length)
        process.exit(1);
})().catch(e => {
    console.error("FAILED: " + e.message);
    process.exit(1);
});
