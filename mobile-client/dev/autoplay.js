// Plays a whole game between two test users on a local server, answering every decision automatically
// (random but legal-looking choices). Used to produce real games for developing the mobile client:
// watch them live as a spectator, or afterwards as replays.
//
//   node autoplay.js [--out DIR] [--delay MS] [--base http://localhost] [--players asdf,qwer]
//
// --players: which side(s) the script plays; leave one out to play that side yourself (for example on the mobile
// screen) - the script still sets up the table for both.
//
// Needs the test users asdf/asdf and qwer/qwer with the decks "Aragorn Starter" and "Gandalf Starter"
// (see README.md in this folder). Every server response is saved to DIR as numbered XML files per player,
// so the mobile game state model can be tested against real event streams.

const fs = require("fs");
const path = require("path");
const {parseXml, findAll} = require("./xml");

const args = process.argv.slice(2);
function arg(name, def) {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
}
const BASE = arg("--base", "http://localhost");
const SERVER = BASE + "/gemp-lotr-server";
const OUT = arg("--out", null);
const DELAY = parseInt(arg("--delay", "0"));
const FORMAT = "fotr_block";
const PLAYING = arg("--players", "asdf,qwer").split(",");

const PLAYERS = [
    {login: "asdf", password: "asdf", deck: "Aragorn Starter"},
    {login: "qwer", password: "qwer", deck: "Gandalf Starter"}
];

// ---- HTTP with a cookie per player ----

async function request(player, method, url, params) {
    const body = params ? new URLSearchParams(params).toString() : undefined;
    const fullUrl = method == "GET" && body ? url + "?" + body : url;
    const response = await fetch(fullUrl, {
        method,
        headers: Object.assign(
            {"Cookie": player.cookie || ""},
            method == "POST" ? {"Content-Type": "application/x-www-form-urlencoded"} : {}),
        body: method == "POST" ? body : undefined
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie)
        player.cookie = setCookie.split(";")[0];
    const text = await response.text();
    if (!response.ok)
        throw new Error(method + " " + url + " -> " + response.status + " " + text.substring(0, 200));
    return text;
}

// ---- Decisions ----

function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function pickSome(items, min, max) {
    const pool = items.slice();
    const count = randomInt(Math.min(min, pool.length), Math.min(max, pool.length));
    const chosen = [];
    for (let i = 0; i < count; i++)
        chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return chosen;
}

function params(decision, name) {
    return decision.children.filter(p => p.tag == "parameter" && p.attrs.name == name).map(p => p.attrs.value);
}

function param(decision, name) {
    const values = params(decision, name);
    return values.length > 0 ? values[0] : null;
}

// repeats: how many times this same decision was already answered (the server asks again after a rejected answer)
function answer(decision, repeats) {
    const type = decision.attrs.decisionType;
    if (type == "INTEGER") {
        const min = parseInt(param(decision, "min") || "0");
        const max = parseInt(param(decision, "max") || "0");
        const def = param(decision, "defaultValue");
        return "" + (def != null ? def : randomInt(min, Math.min(max, min + 2)));
    }
    if (type == "MULTIPLE_CHOICE")
        return "" + randomInt(0, params(decision, "results").length - 1);
    if (type == "ARBITRARY_CARDS" || type == "CARD_SELECTION") {
        const min = parseInt(param(decision, "min") || "0");
        const max = parseInt(param(decision, "max") || "0");
        let ids = params(decision, "cardId");
        if (type == "ARBITRARY_CARDS") {
            const selectable = params(decision, "selectable");
            ids = ids.filter((id, i) => selectable[i] == "true");
        }
        return pickSome(ids, repeats > 0 ? min : Math.max(min, 1), repeats > 0 ? min : max).join(",");
    }
    if (type == "ACTION_CHOICE") {
        const actionIds = params(decision, "actionId");
        return actionIds[randomInt(0, actionIds.length - 1)];
    }
    if (type == "CARD_ACTION_CHOICE") {
        const actionIds = params(decision, "actionId");
        if (actionIds.length == 0 || repeats > 0 || Math.random() < 0.35)
            return "";
        return actionIds[randomInt(0, actionIds.length - 1)];
    }
    if (type == "ASSIGN_MINIONS") {
        const characters = params(decision, "freeCharacters");
        const minions = params(decision, "minions");
        const assigned = characters.map(c => [c]);
        if (repeats == 0) {
            // At most one minion per character; the Shadow player assigns the rest
            pickSome(minions, 0, characters.length).forEach((minion, i) => assigned[i].push(minion));
        }
        return assigned.map(a => a.join(" ")).join(",");
    }
    throw new Error("Unknown decision type " + type);
}

// ---- Playing ----

async function playerLoop(player, gameId, state) {
    const gameUrl = SERVER + "/game/" + gameId;
    let xml = await request(player, "GET", gameUrl);
    let seq = 0;
    let lastDecisionKey = null;
    let repeats = 0;

    while (true) {
        if (OUT)
            fs.writeFileSync(path.join(OUT, player.login + "-" + String(seq++).padStart(4, "0") + ".xml"), xml);

        const root = parseXml(xml);
        const channel = root.attrs.cn;
        const events = findAll(root, "ge");
        let decision = null;
        for (const event of events) {
            // The closing message links the replays: ...replayId%3Dasdf$abc123...
            const replays = (event.attrs.message || "").match(/replayId%3D[^%\s&'"]+/g);
            if (replays)
                replays.forEach(r => state.replays.add(r.substring("replayId%3D".length)));
            if (event.attrs.type == "EG")
                state.ended = true;
            if (event.attrs.type == "D")
                decision = event;
        }
        if (state.ended)
            return;

        if (decision != null) {
            const key = decision.attrs.id + "|" + decision.attrs.text;
            repeats = key == lastDecisionKey ? repeats + 1 : 0;
            lastDecisionKey = key;
            if (repeats > 5)
                throw new Error(player.login + " is stuck on: " + decision.attrs.text);
            if (DELAY > 0)
                await new Promise(r => setTimeout(r, DELAY));
            const value = answer(decision, repeats);
            state.decisions++;
            xml = await request(player, "POST", gameUrl,
                {channelNumber: channel, decisionId: decision.attrs.id, decisionValue: value});
        } else {
            xml = await request(player, "POST", gameUrl, {channelNumber: channel});
        }
    }
}

async function main() {
    if (OUT)
        fs.mkdirSync(OUT, {recursive: true});

    for (const player of PLAYERS)
        await request(player, "POST", SERVER + "/login", {login: player.login, password: player.password});

    const [host, guest] = PLAYERS;

    // Reuse the host's waiting table if there is one, otherwise create it
    const findTable = async (who, predicate) => {
        const hall = parseXml(await request(who, "GET", SERVER + "/hall"));
        return findAll(hall, "table").find(predicate);
    };
    let table = await findTable(host, t => t.attrs.status == "WAITING" && t.attrs.players == host.login);
    if (!table) {
        await request(host, "POST", SERVER + "/hall", {
            format: FORMAT, deckName: host.deck, deckSource: "", timer: "default",
            desc: "autoplay", isPrivate: "false", isInviteOnly: "false"
        });
        table = await findTable(host, t => t.attrs.status == "WAITING" && t.attrs.players == host.login);
    }
    await request(guest, "POST", SERVER + "/hall/" + table.attrs.id, {deckName: guest.deck, deckSource: ""});

    let gameId = null;
    for (let i = 0; i < 30 && !gameId; i++) {
        const playing = await findTable(host, t => t.attrs.id == table.attrs.id);
        gameId = playing && playing.attrs.gameId;
        if (!gameId)
            await new Promise(r => setTimeout(r, 500));
    }
    if (!gameId)
        throw new Error("The game did not start");
    console.log("game " + gameId + " started (spectate: " + BASE + "/gemp-lotr/game.html?gameId=" + gameId + ")");

    const state = {ended: false, decisions: 0, replays: new Set()};
    const started = Date.now();
    await Promise.all(PLAYERS.filter(p => PLAYING.includes(p.login)).map(p => playerLoop(p, gameId, state)));
    console.log("game " + gameId + " ended after " + state.decisions + " decisions in "
        + Math.round((Date.now() - started) / 1000) + " s");
    if (state.replays.size > 0)
        console.log("replays: " + [...state.replays].join(" "));
}

main().catch(e => {
    console.error("FAILED: " + e.message);
    process.exit(1);
});
