// Opens the mobile game screen on a replay at several screen sizes and takes screenshots at interesting moments.
//
//   REPLAY='asdf$<recordingId>' OUT=/tmp/shots NODE_PATH=/opt/node-tools/node_modules node screenshots.js [size]
//
// size: phone-portrait, phone-landscape, tablet-portrait or tablet-landscape (default: all four).
// Logs in as asdf, so the replay must be one of asdf's. Card images are replaced by placeholders with the card code.
const { chromium, devices } = require("playwright");
const fs = require("fs");
const OUT = process.env.OUT || "/tmp/gemp-shots";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost/gemp-lotr/";
const REPLAY = process.env.REPLAY;
if (!REPLAY) {
    console.error("Set REPLAY to a replay id of asdf, for example REPLAY='asdf$abc123'");
    process.exit(1);
}

const SIZES = {
    "phone-portrait": { ...devices["Pixel 7"] },
    "phone-landscape": { ...devices["Pixel 7 landscape"] },
    "tablet-portrait": { ...devices["Galaxy Tab S4"] },
    "tablet-landscape": { ...devices["Galaxy Tab S4 landscape"] }
};

// Card images are hosted elsewhere (blocked here): draw a placeholder with the card's code instead
function placeholder(url) {
    const name = url.split("/").pop().replace(".jpg", "");
    const colors = ["#5b3a29", "#2e4a3a", "#2f3d5c", "#4b2f52", "#5c4f2a"];
    const color = colors[name.length % colors.length];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350">
<rect width="250" height="350" rx="12" fill="${color}"/><rect x="12" y="12" width="226" height="40" rx="6" fill="#00000055"/>
<text x="125" y="40" font-size="22" text-anchor="middle" fill="#f3e6c8" font-family="sans-serif">${name}</text>
<rect x="20" y="64" width="210" height="150" fill="#00000033"/><rect x="20" y="226" width="210" height="100" fill="#f3e6c822"/></svg>`;
}

async function login(context) {
    const page = await context.newPage();
    await page.goto(BASE);
    await page.locator("#login").fill("asdf");
    await page.locator("#password").fill("asdf");
    await page.getByText("Login", { exact: true }).click();
    await page.waitForURL(/hall\.html/);
    await page.close();
}

// Moves the replay forward until the condition on the state holds
async function advanceUntil(page, condition, max = 3000) {
    return page.evaluate(([conditionSource, max]) => {
        const game = window.mobileGame;
        const test = new Function("s", "return " + conditionSource);
        let steps = 0;
        while (!test(game.state) && game.replayIndex < game.replayEvents.length && steps < max) {
            game.stepUntilVisibleChange();
            steps++;
        }
        game.renderer.replay.position = game.replayIndex;
        game.renderer.render();
        return test(game.state);
    }, [condition, max]);
}

(async () => {
    const browser = await chromium.launch();
    const only = process.argv[2];
    for (const [name, device] of Object.entries(SIZES)) {
        if (only && name != only) continue;
        const context = await browser.newContext(device);
        await context.route("https://i.lotrtcgpc.net/**", route =>
            route.fulfill({ contentType: "image/svg+xml", body: placeholder(route.request().url()) }));
        await login(context);
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        page.on("console", m => { if (m.type() == "error" && !/ERR_TUNNEL|ERR_INTERNET/.test(m.text())) errors.push(m.text()); });
        await page.goto(BASE + "game-mobile.html?replayId=" + REPLAY);
        await page.waitForFunction(() => window.mobileGame && window.mobileGame.replayEvents);

        const shots = [
            ["start", "s.initialized"],
            ["assignment", "s.assignments().length > 0"],
            ["skirmish", "s.skirmish != null && s.skirmishCards().shadow.length > 0"],
            ["late", "s.positions.asdf >= 7 && s.skirmish != null"],
            ["end", "s.ended"]
        ];
        for (const [label, condition] of shots) {
            const ok = await advanceUntil(page, condition);
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${OUT}/${name}-${label}.png` });
            console.log(name, label, ok ? "" : "(condition not reached)");
        }
        // A card detail sheet
        const card = page.locator("#mg-zones .mg-row .mg-card").first();
        if (await card.count()) {
            await card.click();
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${OUT}/${name}-card.png` });
            await page.locator(".mg-sheet-close").click();
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        console.log(name, "page wider than screen by", overflow, "px; errors:", errors.length ? errors : "none");
        await context.close();
    }
    await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
