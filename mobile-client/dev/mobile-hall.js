// Checks the way into games on a phone, end to end, as asdf (qwer is played over HTTP):
// login page -> mobile hall (automatic), create a table -> qwer joins -> the game opens on the mobile game screen,
// concede -> back to the hall, join qwer's table, practise against the bot, chat tab, the switch to the standard
// view and back, and that a computer is never sent to the mobile pages.
//
//   NODE_PATH=/opt/node-tools/node_modules node mobile-hall.js [--shots DIR]

const { chromium, devices } = require("playwright");
const assert = require("assert");
const fs = require("fs");
const {parseXml, findAll} = require("./xml");

const args = process.argv.slice(2);
const SHOTS = args.indexOf("--shots") >= 0 ? args[args.indexOf("--shots") + 1] : null;
const BASE = "http://localhost";
const SERVER = BASE + "/gemp-lotr-server";
const PLACEHOLDER = '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350"><rect width="250" height="350" rx="12" fill="#4a3d2a"/></svg>';

let passed = 0;
async function step(name, body) {
    await body();
    passed++;
    console.log("ok   " + name);
}

// ---- qwer, over HTTP ----

const qwer = {cookie: null};
async function asQwer(method, path, params) {
    const body = params ? new URLSearchParams(params).toString() : undefined;
    const response = await fetch(SERVER + path + (method == "GET" && body ? "?" + body : ""), {
        method, body: method == "POST" ? body : undefined,
        headers: {"Content-Type": "application/x-www-form-urlencoded", "Cookie": qwer.cookie || ""}
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie)
        qwer.cookie = setCookie.split(";")[0];
    return response.text();
}

async function hallTables() {
    return findAll(parseXml(await asQwer("GET", "/hall")), "table").map(t => t.attrs);
}

async function newContext(browser, device) {
    const context = await browser.newContext(device);
    await context.route("https://i.lotrtcgpc.net/**", r => r.fulfill({contentType: "image/svg+xml", body: PLACEHOLDER}));
    return context;
}

(async () => {
    if (SHOTS)
        fs.mkdirSync(SHOTS, {recursive: true});
    await asQwer("POST", "/login", {login: "qwer", password: "qwer"});
    // Leftovers from earlier runs: qwer leaves its waiting tables and concedes its running games
    for (const t of await hallTables()) {
        if (t.status == "WAITING" && /qwer/.test(t.players))
            await asQwer("POST", "/hall/" + t.id + "/leave");
        if (t.status == "PLAYING" && /qwer/.test(t.players) && t.gameId)
            await asQwer("POST", "/game/" + t.gameId + "/concede", {});
    }

    const browser = await chromium.launch();
    const context = await newContext(browser, devices["Pixel 7"]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const shot = async name => SHOTS && page.screenshot({path: `${SHOTS}/${name}.png`});

    await step("login page fits the phone, and logging in lands in the mobile hall", async () => {
        await page.goto(BASE + "/gemp-lotr/");
        await shot("login");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, "the login page is wider than the phone by " + overflow + " px");
        await page.locator("#login").fill("asdf");
        await page.locator("#password").fill("asdf");
        await page.getByText("Login", {exact: true}).click();
        await page.waitForURL(/hall-mobile\.html/);
        await page.locator(".mh-connection.mh-on").waitFor();
        await shot("hall");
    });

    let tableId = null;
    await step("create a table: it shows under Your games with Leave", async () => {
        await page.locator('#mh-nav [data-tab="play"]').click();
        await page.locator(".mh-form select").first().waitFor();
        await page.locator(".mh-form").first().locator("select").first().selectOption("fotr_block");
        await page.locator(".mh-form").first().locator("select").nth(1).selectOption("player:Aragorn Starter");
        await shot("play");
        await page.getByRole("button", {name: "Create table"}).click();
        await page.locator(".mh-mine .mh-table", {hasText: "Fellowship Block"}).waitFor({timeout: 10000});
        await shot("your-table");
        const mine = (await hallTables()).find(t => t.status == "WAITING" && t.players == "asdf");
        assert.ok(mine, "the server has the table");
        tableId = mine.id;
        assert.equal(await page.locator(`.mh-mine [data-action="leave"][data-id="${tableId}"]`).count(), 1);
    });

    await step("qwer joins: the game opens by itself on the mobile game screen", async () => {
        await asQwer("POST", "/hall/" + tableId, {deckName: "Gandalf Starter", deckSource: ""});
        await page.waitForURL(/game-mobile\.html\?gameId=\d+/, {timeout: 15000});
        await page.waitForFunction(() => window.mobileGame && window.mobileGame.renderer.decision, null, {timeout: 20000});
    });

    await step("concede, then back to the hall from the game-over screen", async () => {
        // Still bidding burdens (qwer doesn't answer here): conceding works from the start, as on the desktop
        await page.locator('[data-action="menu"]').click();
        await page.locator('[data-action="concede"]').click();
        await page.locator('[data-action="confirm-yes"]').click();
        await page.locator(".mg-sheet-title", {hasText: "Game over"}).waitFor({timeout: 20000});
        await page.getByRole("link", {name: "Back to the game hall"}).click();
        await page.waitForURL(/hall-mobile\.html/);
    });

    await step("join qwer's table: choose a deck, then the game opens", async () => {
        await asQwer("POST", "/hall", {format: "fotr_block", deckName: "Gandalf Starter", deckSource: "", timer: "default",
            desc: "from qwer", isPrivate: "false", isInviteOnly: "false"});
        const join = page.locator('.mh-table', {hasText: "from qwer"}).locator('[data-action="join"]');
        await join.waitFor({timeout: 10000});
        await join.click();
        await page.locator(".mg-sheet-body select").selectOption("player:Aragorn Starter");
        await shot("join");
        await page.locator(".mg-sheet-body").getByRole("button", {name: "Join table"}).click();
        await page.waitForURL(/game-mobile\.html\?gameId=\d+/, {timeout: 15000});
        // Leave this game behind: qwer concedes it
        const gameId = new URL(page.url()).searchParams.get("gameId");
        await asQwer("POST", "/game/" + gameId + "/concede", {});
        await page.goto(BASE + "/gemp-lotr/hall.html");
        await page.waitForURL(/hall-mobile\.html/);
    });

    await step("practise against the bot: the game opens", async () => {
        await page.locator('#mh-nav [data-tab="play"]').click();
        await page.locator(".mh-form").nth(1).locator("select").selectOption("player:Aragorn Starter");
        await page.getByRole("button", {name: "Play against the bot"}).click();
        await page.waitForURL(/game-mobile\.html\?gameId=\d+/, {timeout: 20000});
        await page.waitForFunction(() => window.mobileGame && window.mobileGame.state.pregame, null, {timeout: 20000});
        await page.locator('[data-action="menu"]').click();
        if (await page.locator('[data-action="concede"]').count() > 0) {
            await page.locator('[data-action="concede"]').click();
            await page.locator('[data-action="confirm-yes"]').click();
        }
        await page.goto(BASE + "/gemp-lotr/hall.html");
        await page.waitForURL(/hall-mobile\.html/);
    });

    await step("chat tab: the hall chat room", async () => {
        await page.locator('#mh-nav [data-tab="chat"]').click();
        await page.locator(".mh-chat .mg-chat-log").waitFor();
        await page.locator(".mh-chat .mg-chat-log", {hasText: "Welcome"}).waitFor({timeout: 10000});
        await shot("chat");
    });

    await step("switch to the standard view, and back with the Mobile view button", async () => {
        await page.locator('#mh-nav [data-tab="more"]').click();
        await shot("more");
        await page.locator('[data-action="standard-view"]').click();
        await page.waitForURL(/\/hall\.html/);
        await page.waitForTimeout(1000);
        assert.ok(/\/hall\.html/.test(page.url()), "stays on the standard hall");
        const button = page.getByRole("button", {name: "📱 Mobile view"});
        await button.waitFor();
        await shot("standard-with-button");
        await button.click();
        await page.waitForURL(/hall-mobile\.html/);
    });

    for (const [name, device] of [["phone-landscape", "Pixel 7 landscape"], ["tablet", "Galaxy Tab S4"], ["tablet-landscape", "Galaxy Tab S4 landscape"]]) {
        await step("hall at " + name + " size: no sideways scrolling", async () => {
            const other = await newContext(browser, devices[device]);
            await other.addCookies(await context.cookies());
            const p = await other.newPage();
            p.on("pageerror", e => errors.push(e.message));
            await p.goto(BASE + "/gemp-lotr/hall.html");
            await p.waitForURL(/hall-mobile\.html/);
            await p.locator(".mh-connection.mh-on").waitFor();
            if (SHOTS)
                await p.screenshot({path: `${SHOTS}/hall-${name}.png`});
            const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            assert.ok(overflow <= 0, "wider than the screen by " + overflow + " px");
            await other.close();
        });
    }

    await step("a computer is never sent to the mobile pages", async () => {
        const desktop = await newContext(browser, {viewport: {width: 1400, height: 900}});
        await desktop.addCookies((await context.cookies()).filter(c => c.name == "loggedUser"));
        const p = await desktop.newPage();
        await p.goto(BASE + "/gemp-lotr/hall.html");
        await p.waitForTimeout(1500);
        assert.ok(/\/hall\.html/.test(p.url()), "the computer stays on hall.html, got " + p.url());
        assert.equal(await p.getByRole("button", {name: "📱 Mobile view"}).count(), 0, "no Mobile view button on a computer");
        await desktop.close();
    });

    console.log("\n" + passed + " passed; script errors: " + (errors.length ? errors.join(" | ") : "none"));
    await browser.close();
    if (errors.length)
        process.exit(1);
})().catch(e => {
    console.error("FAILED: " + e.message);
    process.exit(1);
});
