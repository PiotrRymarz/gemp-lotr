// Tests for answering decisions on the mobile screen (gemp-lotr-async/src/main/web/src/GameMobile/decisions.js):
// the taps and buttons of each decision type, and the answer sent to the server.
//
//   node test-decisions.js

const assert = require("assert");
const GameState = require("../../gemp-lotr/gemp-lotr-async/src/main/web/src/GameMobile/state.js");
const MobileDecisions = require("../../gemp-lotr/gemp-lotr-async/src/main/web/src/GameMobile/decisions.js");

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

function ev(type, attr) {
    return {type, attr: Object.assign({type}, attr), children: []};
}

// A game with my companions 1, 2, a card in hand (3) and the opponent's minions 10, 11, 12
function table() {
    const state = new GameState();
    state.apply(ev("P", {participantId: "me", allParticipantIds: "opp,me"}));
    state.apply(ev("PCIP", {cardId: "1", blueprintId: "1_290", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "2", blueprintId: "1_97", zone: "FREE_CHARACTERS", participantId: "me"}));
    state.apply(ev("PCIP", {cardId: "3", blueprintId: "1_108", zone: "HAND", participantId: "me"}));
    for (const id of ["10", "11", "12"])
        state.apply(ev("PCIP", {cardId: id, blueprintId: "1_178", zone: "SHADOW_CHARACTERS", participantId: "opp"}));
    return state;
}

// Builds a decision the way state.js stores it; params: {name: value or [values]}
function decision(type, params, text) {
    const p = {};
    for (const name in params)
        p[name] = [].concat(params[name]);
    return {id: "5", type, text: text || "Question", participantId: "me", params: p};
}

function make(state, d, options) {
    const sent = [];
    const answering = MobileDecisions.create(d, state, value => sent.push(value), options);
    return {d: answering, sent};
}

test("every decision type the server uses has a handler", () => {
    assert.deepEqual(MobileDecisions.TYPES.sort(),
        ["ACTION_CHOICE", "ARBITRARY_CARDS", "ASSIGN_MINIONS", "CARD_ACTION_CHOICE", "CARD_SELECTION", "INTEGER", "MULTIPLE_CHOICE"]);
});

test("INTEGER: starts at the default, stays within min and max", () => {
    const {d, sent} = make(table(), decision("INTEGER", {min: "0", max: "2", defaultValue: "1"}));
    assert.equal(d.stepper.value, 1);
    d.press("inc");
    d.press("inc");
    assert.equal(d.stepper.value, 2);
    d.press("dec");
    d.press("dec");
    d.press("dec");
    assert.equal(d.stepper.value, 0);
    d.press("done");
    assert.deepEqual(sent, ["0"]);
});

test("INTEGER: no max means a high limit, no default means the minimum", () => {
    const {d} = make(table(), decision("INTEGER", {min: "0"}));
    assert.equal(d.stepper.value, 0);
    assert.equal(d.stepper.max, 1000);
});

test("MULTIPLE_CHOICE: one button per result, the answer is its index", () => {
    const {d, sent} = make(table(), decision("MULTIPLE_CHOICE", {results: ["Yes", "No", "Maybe"]}));
    assert.deepEqual(d.controls().map(c => c.label), ["Yes", "No", "Maybe"]);
    d.press("choice:2");
    d.press("choice:0");
    assert.deepEqual(sent, ["2"], "only the first press is sent");
});

test("CARD_SELECTION: toggle cards up to max, Done needs min", () => {
    const state = table();
    const {d, sent} = make(state, decision("CARD_SELECTION", {min: "1", max: "2", cardId: ["1", "2", "3"]}));
    assert.equal(d.isSelectable("1"), true);
    assert.equal(d.isSelectable("10"), false);
    assert.equal(d.usesHand, true, "card 3 is in hand");
    assert.equal(d.controls().find(c => c.name == "done").disabled, true);
    d.tap("1");
    d.tap("2");
    d.tap("3");
    assert.deepEqual(d.selected, ["1", "2"], "the maximum is 2");
    d.tap("1");
    d.tap("3");
    assert.deepEqual(d.selected, ["2", "3"]);
    assert.equal(d.note, "Choose 1 to 2");
    d.press("done");
    assert.deepEqual(sent, ["2,3"]);
});

test("CARD_SELECTION: Reset clears the selection; with min 0 Done sends nothing selected", () => {
    const {d, sent} = make(table(), decision("CARD_SELECTION", {min: "0", max: "1", cardId: ["1"]}));
    d.tap("1");
    d.press("reset");
    assert.deepEqual(d.selected, []);
    d.press("done");
    assert.deepEqual(sent, [""]);
});

test("ARBITRARY_CARDS: the cards come in a strip, only selectable ones can be picked", () => {
    const {d, sent} = make(table(), decision("ARBITRARY_CARDS", {
        min: "1", max: "1", cardId: ["40", "41"], blueprintId: ["1_50", "1_51"], selectable: ["false", "true"],
        testingText: ["null", "null"]
    }));
    assert.deepEqual(d.choiceCards.map(c => [c.id, c.blueprintId, c.selectable]), [["40", "1_50", false], ["41", "1_51", true]]);
    d.tap("40");
    assert.deepEqual(d.selected, []);
    d.tap("41");
    d.press("done");
    assert.deepEqual(sent, ["41"]);
});

test("ARBITRARY_CARDS: a reveal with nothing to pick shows just OK", () => {
    const {d, sent} = make(table(), decision("ARBITRARY_CARDS", {
        min: "0", max: "0", cardId: ["40"], blueprintId: ["1_50"], selectable: ["false"], testingText: ["null"]
    }));
    assert.deepEqual(d.controls().map(c => c.label), ["OK"]);
    d.press("done");
    assert.deepEqual(sent, [""]);
});

test("ACTION_CHOICE: pick one action shown as a card, Done sends its action id", () => {
    const {d, sent} = make(table(), decision("ACTION_CHOICE", {
        blueprintId: ["1_2", "1_3"], actionId: ["7", "8"], actionText: ["Wear the ring", "Heal"]
    }));
    assert.equal(d.controls()[0].disabled, true);
    d.tap("action1");
    assert.equal(d.isSelected("action1"), true);
    d.tap("action0");
    d.press("done");
    assert.deepEqual(sent, ["7"]);
});

test("CARD_ACTION_CHOICE: a card with one action is picked with one tap; Pass sends nothing", () => {
    const state = table();
    const {d, sent} = make(state, decision("CARD_ACTION_CHOICE", {
        cardId: ["3", "1"], blueprintId: ["inPlay", "inPlay"], actionId: ["21", "22"], actionText: ["Play", "Use"],
        testingText: ["null", "null"]
    }));
    assert.equal(d.usesHand, true);
    assert.deepEqual(d.controls().map(c => c.label), ["Pass"]);
    d.tap("3");
    assert.equal(d.isSelected("3"), true);
    assert.deepEqual(d.controls().map(c => c.label), ["Reset", "Done"]);
    assert.equal(d.note, "Selected: Play");
    d.press("done");
    assert.deepEqual(sent, ["21"]);

    const pass = make(table(), decision("CARD_ACTION_CHOICE", {cardId: [], blueprintId: [], actionId: [], actionText: []}));
    pass.d.press("pass");
    assert.deepEqual(pass.sent, [""]);
});

test("CARD_ACTION_CHOICE: several actions on a card ask which one", () => {
    const {d, sent} = make(table(), decision("CARD_ACTION_CHOICE", {
        cardId: ["1", "1"], blueprintId: ["inPlay", "inPlay"], actionId: ["31", "32"], actionText: ["Heal", "Exert"],
        testingText: ["null", "null"]
    }));
    const result = d.tap("1");
    assert.deepEqual(result.menu.map(a => a.text), ["Heal", "Exert"]);
    assert.equal(d.isSelected("1"), false, "nothing is picked until an action is chosen");
    d.choose("32");
    assert.equal(d.isSelected("1"), true);
    d.press("done");
    assert.deepEqual(sent, ["32"]);
});

test("CARD_ACTION_CHOICE: cards from elsewhere (not in play) appear in the strip", () => {
    const {d, sent} = make(table(), decision("CARD_ACTION_CHOICE", {
        cardId: ["55"], blueprintId: ["1_120"], actionId: ["41"], actionText: ["Play from discard"], testingText: ["null"]
    }));
    assert.deepEqual(d.choiceCards.map(c => [c.id, c.blueprintId]), [["extra55", "1_120"]]);
    d.tap("extra55");
    d.press("done");
    assert.deepEqual(sent, ["41"]);
});

test("ASSIGN_MINIONS: tap a minion then a character; the table shows it; answer lists every character", () => {
    const state = table();
    const {d, sent} = make(state, decision("ASSIGN_MINIONS", {freeCharacters: ["1", "2"], minions: ["10", "11", "12"]}));
    assert.equal(d.isSelectable("10"), true);
    assert.equal(d.isSelectable("1"), false, "first a minion");
    d.tap("10");
    assert.equal(d.isSelectable("1"), true);
    d.tap("1");
    d.tap("11");
    d.tap("1");
    d.tap("12");
    d.tap("2");
    assert.equal(state.cards["10"].assign, "1", "the table shows the assignment");
    assert.deepEqual(state.assignments().map(g => g.characterId), ["1", "2"]);
    d.press("done");
    assert.deepEqual(sent, ["1 10 11,2 12"]);
});

test("ASSIGN_MINIONS: tapping the minion again unassigns it; unassigned minions need a confirmation", () => {
    const state = table();
    const {d, sent} = make(state, decision("ASSIGN_MINIONS", {freeCharacters: ["1", "2"], minions: ["10", "11"]}));
    d.tap("10");
    d.tap("2");
    d.tap("10");
    d.tap("10");
    assert.equal(state.cards["10"].assign, null);
    d.tap("11");
    d.tap("1");
    d.press("done");
    assert.equal(d.confirming, true);
    assert.equal(d.note, "1 minion is not assigned. Send anyway?");
    assert.deepEqual(sent, []);
    d.press("back");
    assert.equal(d.confirming, false);
    d.press("done");
    d.press("send");
    assert.deepEqual(sent, ["1 11,2"]);
});

test("ASSIGN_MINIONS: assignments already made stay, Reset goes back to them", () => {
    const state = table();
    state.apply(ev("AA", {cardId: "2", otherCardIds: "12"}));
    const {d, sent} = make(state, decision("ASSIGN_MINIONS", {freeCharacters: ["1", "2"], minions: ["10", "12"]}));
    d.tap("12");
    d.tap("1");
    d.tap("10");
    d.tap("2");
    d.press("reset");
    assert.equal(state.cards["12"].assign, "2");
    assert.equal(state.cards["10"].assign, null);
    d.tap("10");
    d.tap("1");
    d.press("done");
    assert.deepEqual(sent, ["1 10,2 12"]);
});

test("auto-accept: picking the last card needed, or an action, sends at once", () => {
    const auto = {autoAccept: true};
    const selection = make(table(), decision("CARD_SELECTION", {min: "1", max: "2", cardId: ["1", "2"]}), auto);
    selection.d.tap("1");
    assert.deepEqual(selection.sent, [], "1 of 2: not yet");
    selection.d.tap("2");
    assert.deepEqual(selection.sent, ["1,2"]);

    const action = make(table(), decision("CARD_ACTION_CHOICE", {
        cardId: ["3"], blueprintId: ["inPlay"], actionId: ["21"], actionText: ["Play"], testingText: ["null"]
    }), auto);
    action.d.tap("3");
    assert.deepEqual(action.sent, ["21"]);

    const menu = make(table(), decision("CARD_ACTION_CHOICE", {
        cardId: ["1", "1"], blueprintId: ["inPlay", "inPlay"], actionId: ["31", "32"], actionText: ["Heal", "Exert"],
        testingText: ["null", "null"]
    }), auto);
    menu.d.tap("1");
    assert.deepEqual(menu.sent, [], "the menu comes first");
    menu.d.choose("31");
    assert.deepEqual(menu.sent, ["31"]);

    const choice = make(table(), decision("ACTION_CHOICE", {blueprintId: ["1_2"], actionId: ["7"], actionText: ["Go"]}), auto);
    choice.d.tap("action0");
    assert.deepEqual(choice.sent, ["7"]);

    const off = make(table(), decision("CARD_SELECTION", {min: "1", max: "1", cardId: ["1"]}));
    off.d.tap("1");
    assert.deepEqual(off.sent, [], "without auto-accept Done is needed");
});

console.log("\n" + passed + " passed" + (process.exitCode ? ", some FAILED" : ""));
