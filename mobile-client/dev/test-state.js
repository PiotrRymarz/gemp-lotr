// Tests for the mobile game state model (gemp-lotr-async/src/main/web/src/GameMobile/state.js).
//
//   node test-state.js
//
// 1. Small hand-made event sequences for the tricky handlers.
// 2. A real recorded game (fixtures/), played through the model twice: from the live event stream the server sent
//    to a player, and from the replay of the same game. Both must end with the same table.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {parseXml, findAll, toEvent} = require("./xml");
const GameState = require("../../gemp-lotr/gemp-lotr-async/src/main/web/src/GameMobile/state.js");

let passed = 0;
function test(name, body) {
    try {
        body();
        passed++;
        console.log("ok   " + name);
    } catch (e) {
        console.log("FAIL " + name + "\n     " + e.message);
        process.exitCode = 1;
    }
}

function ev(type, attr, children) {
    return {type, attr: Object.assign({type}, attr), children: children || []};
}

function newGame() {
    const state = new GameState();
    state.apply(ev("P", {participantId: "me", allParticipantIds: "opp,me"}));
    return state;
}

// ---- Hand-made sequences ----

test("participant: the bottom player is me, or the second player for spectators", () => {
    const state = newGame();
    assert.equal(state.bottomPlayerId, "me");
    assert.equal(state.spectator, false);
    const spectating = new GameState();
    spectating.apply(ev("P", {participantId: "watcher", allParticipantIds: "a,b"}));
    assert.equal(spectating.spectator, true);
    assert.equal(spectating.bottomPlayerId, "b");
    assert.deepEqual(spectating.opponentIds(), ["a"]);
});

test("cards go to rows by zone and owner, controller wins over owner", () => {
    const state = newGame();
    state.apply(ev("PCIP", {cardId: "1", blueprintId: "1_2", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "2", blueprintId: "1_3", zone: "SUPPORT", participantId: "opp"}));
    state.apply(ev("PCIP", {cardId: "3", blueprintId: "1_4", zone: "SUPPORT", participantId: "opp", controllerId: "me"}));
    assert.deepEqual(state.zoneCards("FREE_CHARACTERS", true).map(c => c.cardId), ["1"]);
    assert.deepEqual(state.zoneCards("SUPPORT", false).map(c => c.cardId), ["2"]);
    assert.deepEqual(state.zoneCards("SUPPORT", true).map(c => c.cardId), ["3"]);
});

test("attached and stacked cards follow their host, move and disappear", () => {
    const state = newGame();
    state.apply(ev("PCIP", {cardId: "1", blueprintId: "1_2", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "2", blueprintId: "1_9", zone: "ATTACHED", participantId: "me", targetCardId: "1", targetType: "attached"}));
    state.apply(ev("PCIP", {cardId: "3", blueprintId: "1_10", zone: "STACKED", participantId: "me", targetCardId: "1", targetType: "stacked"}));
    state.apply(ev("PCIP", {cardId: "4", blueprintId: "1_11", zone: "ATTACHED", participantId: "me", targetCardId: "1"}));
    assert.deepEqual(state.attachedTo("1").map(c => c.cardId), ["2", "4"], "no target type means attached (old replays)");
    assert.deepEqual(state.stackedOn("1").map(c => c.cardId), ["3"]);

    state.apply(ev("PCIP", {cardId: "5", blueprintId: "1_5", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("MCIP", {cardId: "2", zone: "ATTACHED", participantId: "me", targetCardId: "5", targetType: "attached"}));
    assert.deepEqual(state.attachedTo("1").map(c => c.cardId), ["4"]);
    assert.deepEqual(state.attachedTo("5").map(c => c.cardId), ["2"]);

    state.apply(ev("MCIP", {cardId: "3", zone: "DISCARD", participantId: "me"}));
    assert.deepEqual(state.stackedOn("1"), []);
    assert.deepEqual(state.pile("me", "DISCARD").map(c => c.cardId), ["3"]);

    state.apply(ev("RCFP", {otherCardIds: "4,5"}));
    assert.equal(state.cards["4"], undefined);
    assert.equal(state.cards["5"], undefined);
});

test("assignments take characters out of their row; split skirmishes use a ghost", () => {
    const state = newGame();
    state.apply(ev("PCIP", {cardId: "1", blueprintId: "1_2", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "2", blueprintId: "1_5", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "10", blueprintId: "1_150", zone: "SHADOW_CHARACTERS", participantId: "opp"}));
    state.apply(ev("PCIP", {cardId: "11", blueprintId: "1_151", zone: "SHADOW_CHARACTERS", participantId: "opp"}));
    state.apply(ev("PCIP", {cardId: "12", blueprintId: "1_152", zone: "SHADOW_CHARACTERS", participantId: "opp"}));

    state.apply(ev("AA", {cardId: "1", otherCardIds: "10,11"}));
    assert.deepEqual(state.zoneCards("FREE_CHARACTERS", true).map(c => c.cardId), ["2"]);
    assert.deepEqual(state.unassignedMinions().map(c => c.cardId), ["12"]);
    const groups = state.assignments();
    assert.equal(groups.length, 1);
    assert.equal(groups[0].character.cardId, "1");
    assert.deepEqual(groups[0].minions.map(c => c.cardId), ["10", "11"]);

    state.apply(ev("AA", {cardId: "-2", otherCardIds: "12"}));
    const ghost = state.assignments().find(g => g.characterId == "-2");
    assert.equal(ghost.ghost, true);
    assert.equal(ghost.character.cardId, "2");
    assert.deepEqual(state.zoneCards("FREE_CHARACTERS", true).map(c => c.cardId), ["2"], "the real card stays in its row");

    state.apply(ev("RA", {cardId: "-2", otherCardIds: "12"}));
    state.apply(ev("RA", {cardId: "1"}));
    assert.deepEqual(state.assignments(), []);
    assert.deepEqual(state.zoneCards("FREE_CHARACTERS", true).map(c => c.cardId), ["1", "2"]);
});

test("skirmish: cards join and leave, strength is tracked, end clears it", () => {
    const state = newGame();
    state.apply(ev("PCIP", {cardId: "1", blueprintId: "1_2", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "10", blueprintId: "1_150", zone: "SHADOW_CHARACTERS", participantId: "opp"}));
    state.apply(ev("PCIP", {cardId: "11", blueprintId: "1_151", zone: "SHADOW_CHARACTERS", participantId: "opp"}));
    state.apply(ev("SS", {cardId: "1", otherCardIds: "10"}));
    state.apply(ev("ATS", {cardId: "11"}));
    state.apply(ev("GS", {fellowshipStrength: "7", shadowStrength: "12", fpOverwhelmed: "true", shadowDamageBonus: "1"}));
    let skirmish = state.skirmishCards();
    assert.deepEqual(skirmish.fellowship.map(c => c.cardId), ["1"]);
    assert.deepEqual(skirmish.shadow.map(c => c.cardId), ["10", "11"]);
    assert.equal(state.skirmish.fpStrength, "7");
    assert.equal(state.skirmish.fpOverwhelmed, true);
    assert.equal(state.skirmish.shadowDamageBonus, 1);
    state.apply(ev("RFS", {cardId: "11"}));
    assert.deepEqual(state.skirmishCards().shadow.map(c => c.cardId), ["10"]);
    state.apply(ev("ES", {}));
    assert.equal(state.skirmish, null);
    assert.deepEqual(state.skirmishCards().fellowship, []);
});

test("tokens, flips, turn change and inactive cards", () => {
    const state = newGame();
    state.apply(ev("PCIP", {cardId: "1", blueprintId: "1_2", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "2", blueprintId: "1_3", zone: "FREE_CHARACTERS", participantId: "opp"}));
    state.apply(ev("AT", {cardId: "1", token: "WOUND", count: "2"}));
    state.apply(ev("RT", {cardId: "1", token: "WOUND", count: "1"}));
    assert.equal(state.cards["1"].tokens.WOUND, 1);
    state.apply(ev("FCIP", {otherCardIds: "1", hindered: "true"}));
    assert.equal(state.cards["1"].flipped, true);
    state.apply(ev("TC", {participantId: "opp", otherCardIds: "1"}));
    assert.equal(state.currentPlayerId, "opp");
    assert.equal(state.cards["1"].inactive, true);
    assert.equal(state.cards["2"].inactive, false);
    state.apply(ev("TC", {participantId: "me"}));
    assert.equal(state.cards["1"].inactive, true, "no card list: inactive cards stay as they were");
});

test("game stats: character stats, counters, piles and threats", () => {
    const state = newGame();
    state.apply(ev("PCIP", {cardId: "1", blueprintId: "1_290", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "2", blueprintId: "1_150", zone: "SHADOW_CHARACTERS", participantId: "opp"}));
    state.apply(ev("PCIP", {cardId: "3", blueprintId: "1_89", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("GS", {
        charStats: "1=3|4|RF10,2=9|3|5,3=6|3|R7", fellowshipArchery: "2", shadowArchery: "null",
        moveCount: "1", moveLimit: "2", initiative: "FREE_PEOPLE", ruleof4: "3"
    }, [
        {tag: "playerZones", attr: {name: "me", HAND: "8", DECK: "40", DISCARD: "2", DEAD: "0", ADVENTURE_DECK: "8", REMOVED: "0", handRevealed: "false"}},
        {tag: "threats", attr: {name: "me", value: "1"}},
        {tag: "threatTotals", attr: {name: "me", value: "3"}}
    ]));
    assert.deepEqual(state.cards["1"].stats, {strength: "3", vitality: "4", resistance: "10", resistanceKind: "F", siteNumber: null});
    assert.deepEqual(state.cards["2"].stats, {strength: "9", vitality: "3", resistance: null, resistanceKind: null, siteNumber: "5"});
    assert.equal(state.cards["3"].stats.resistance, "7");
    assert.equal(state.fellowshipArchery, "2");
    assert.equal(state.shadowArchery, null);
    assert.equal(state.moveCount + "/" + state.moveLimit, "1/2");
    assert.equal(state.ruleOf4, 3);
    assert.equal(state.players.me.hand, 8);
    assert.equal(state.players.me.threats, 1);
    assert.equal(state.players.me.threatTotal, 3);
});

test("decisions: parameters are collected, a new batch clears the decision", () => {
    const state = newGame();
    state.apply(ev("D", {id: "7", decisionType: "CARD_SELECTION", text: "Choose", participantId: "me"}, [
        {tag: "parameter", attr: {name: "min", value: "1"}},
        {tag: "parameter", attr: {name: "cardId", value: "4"}},
        {tag: "parameter", attr: {name: "cardId", value: "5"}}
    ]));
    assert.deepEqual(state.decision.params.cardId, ["4", "5"]);
    assert.equal(state.decision.type, "CARD_SELECTION");
    state.beginBatch();
    assert.equal(state.decision, null);
});

test("meta-sites from the pre-game setup", () => {
    const state = new GameState();
    state.apply(ev("PGS", {metaSites: "a:90_1|91_1;90_2|91_2,b:90_3|91_3", summary: "Hi", allParticipantIds: "a,b", participantId: "a"}));
    assert.equal(state.metaSiteVisuals["91_2"], "90_2");
    assert.equal(state.metaSiteVisuals["91_3"], "90_3");
    assert.equal(state.pregame.summary, "Hi");
});

// ---- A recorded game ----

const FIXTURES = path.join(__dirname, "fixtures");

function playLiveStream(dir) {
    const state = new GameState();
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".xml")).sort();
    for (const file of files) {
        const root = parseXml(fs.readFileSync(path.join(dir, file), "utf8"));
        const events = findAll(root, "ge");
        if (events.length > 0)
            state.beginBatch();
        for (const event of events)
            state.apply(toEvent(event));
    }
    return state;
}

function playReplay(file) {
    const state = new GameState();
    const root = parseXml(fs.readFileSync(file, "utf8"));
    for (const event of findAll(root, "ge")) {
        state.beginBatch();
        state.apply(toEvent(event));
    }
    return state;
}

function tableSummary(state) {
    const cards = Object.values(state.cards)
        .map(c => [c.cardId, c.blueprintId, c.zone, c.owner, c.attachedTo, c.stackedOn, JSON.stringify(c.tokens)].join(" "))
        .sort();
    return {cards, phase: state.phase, twilight: state.twilight, positions: state.positions, players: state.players};
}

test("recorded game: the live stream plays through to the end", () => {
    const state = playLiveStream(path.join(FIXTURES, "game1-asdf"));
    assert.equal(state.ended, true);
    assert.deepEqual(state.playerIds.slice().sort(), ["asdf", "qwer"]);
    assert.equal(state.bottomPlayerId, "asdf");
    assert.equal(state.sites().length >= 9, true, "all nine sites were played");
    assert.equal(state.positions.asdf, 9);
    assert.ok(state.messages.some(m => /asdf is the winner/.test(m.text)));
    for (const card of Object.values(state.cards)) {
        if (card.attachedTo != null)
            assert.ok(state.cards[card.attachedTo], "attached card " + card.cardId + " has its host");
    }
});

test("recorded game: the replay ends with the same table as the live stream", () => {
    const live = tableSummary(playLiveStream(path.join(FIXTURES, "game1-asdf")));
    const replay = tableSummary(playReplay(path.join(FIXTURES, "game1-replay-asdf.xml")));
    assert.deepEqual(replay, live);
});

console.log("\n" + passed + " passed" + (process.exitCode ? ", some FAILED" : ""));
