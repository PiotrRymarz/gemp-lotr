// Tests for the mobile game hall's state (gemp-lotr-async/src/main/web/src/HallMobile/hallState.js).
//
//   node test-hall.js

const assert = require("assert");
const {parseXml} = require("./xml");
const HallState = require("../../gemp-lotr/gemp-lotr-async/src/main/web/src/HallMobile/hallState.js");

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

// The <hall> answer as the server sends it, read into the form HallState.apply takes
function hall(xml) {
    const root = parseXml(xml);
    return {tag: root.tag, attr: root.attrs, children: root.children.map(c => ({tag: c.tag, attr: c.attrs}))};
}

const SNAPSHOT = `<hall channelNumber="4" motd="Welcome!" serverTime="2026-10-22 21:25:46" serverTimeMs="1000000">
<queue action="add" id="fotr_daily_eu" queue="Daily"/>
<table action="add" id="1" status="WAITING" statusDescription="Waiting" format="Fellowship Block" tournament="Casual - Default" players="qwer" playing="false" createdAt="910000" isPrivate="false" isInviteOnly="false" gameId=""/>
<table action="add" id="2" status="WAITING" statusDescription="Waiting" format="Movie Block" tournament="Casual - Default" players="asdf" playing="true" createdAt="940000" userDescription="bring it" isPrivate="false" isInviteOnly="false"/>
<table action="add" id="3" status="PLAYING" statusDescription="At sites: 5, 5" format="Standard" tournament="Casual - Blitz!" players="a,b" playing="false" watchable="true" gameId="77"/>
<table action="add" id="4" status="PLAYING" statusDescription="At sites: 2, 1" format="Standard" tournament="Casual - Default" players="asdf,c" playing="true" watchable="false" gameId="78"/>
<table action="add" id="5" status="WAITING" statusDescription="Waiting" format="Standard" tournament="Casual - Default" players="d" playing="false" isInviteOnly="true" userDescription="someone" isPrivate="true"/>
<table action="add" id="6" status="FINISHED" statusDescription="Finished" format="Standard" tournament="Casual" players="e,f" playing="false" winner="e"/>
</hall>`;

test("a snapshot: channel, message of the day, tables and events", () => {
    const s = new HallState();
    s.apply(hall(SNAPSHOT), true, 1000000);
    assert.equal(s.channelNumber, "4");
    assert.equal(s.motd, "Welcome!");
    assert.equal(Object.keys(s.tables).length, 6);
    assert.equal(s.eventCount, 1);
    assert.deepEqual(s.tables["3"].players, ["a", "b"]);
});

test("your tables come first: the game in progress, then the waiting table", () => {
    const s = new HallState();
    s.apply(hall(SNAPSHOT), true, 1000000);
    assert.deepEqual(s.myTables().map(t => t.id), ["4", "2"]);
    assert.deepEqual(s.otherTables("WAITING").map(t => t.id), ["1", "5"]);
    assert.deepEqual(s.otherTables("PLAYING").map(t => t.id), ["3"]);
    assert.deepEqual(s.otherTables("FINISHED").map(t => t.id), ["6"]);
});

test("what can be done at each table", () => {
    const s = new HallState();
    s.apply(hall(SNAPSHOT), true, 1000000);
    const actions = Object.values(s.tables).map(t => t.id + ":" + HallState.action(t));
    assert.deepEqual(actions, ["1:join", "2:leave", "3:watch", "4:play", "5:null", "6:null"]);
    assert.equal(HallState.note(s.tables["2"]), "bring it");
    assert.equal(HallState.note(s.tables["5"]), "Private match for someone");
});

test("an invite-only table that names you can be joined", () => {
    const s = new HallState();
    s.apply(hall(`<hall channelNumber="1"><table action="add" id="9" status="WAITING" players="x" playing="false" isInviteOnly="true" invitedYou="true" userDescription="asdf"/></hall>`), true);
    assert.equal(HallState.action(s.tables["9"]), "join");
});

test("updates change, move and remove tables; their order stays", () => {
    const s = new HallState();
    s.apply(hall(SNAPSHOT), true, 1000000);
    s.apply(hall(`<hall channelNumber="5">
        <table action="update" id="1" status="PLAYING" statusDescription="At sites: 1, 1" format="Fellowship Block" players="qwer,asdf" playing="true" gameId="80"/>
        <table action="remove" id="6"/>
        <newGame id="80"/></hall>`), false, 1000000);
    assert.equal(s.channelNumber, "5");
    assert.equal(s.tables["6"], undefined);
    assert.deepEqual(s.myTables().map(t => t.id), ["1", "4", "2"], "the new game joins your games");
    assert.deepEqual(s.newGames, ["80"]);
    assert.equal(s.motd, "Welcome!", "an update without a message of the day keeps it");
    s.apply(hall(`<hall channelNumber="6"/>`), false);
    assert.deepEqual(s.newGames, [], "a game is announced once");
});

test("a new snapshot replaces everything", () => {
    const s = new HallState();
    s.apply(hall(SNAPSHOT), true, 1000000);
    s.apply(hall(`<hall channelNumber="9"><table action="add" id="20" status="WAITING" players="z" playing="false"/></hall>`), true);
    assert.deepEqual(Object.keys(s.tables), ["20"]);
    assert.equal(s.eventCount, 0);
});

test("waiting time uses the server's clock", () => {
    const s = new HallState();
    // The server's clock is 1000000 when ours is 400000: 600 s ahead
    s.apply(hall(SNAPSHOT), true, 400000);
    assert.equal(s.waitingFor(s.tables["1"], 400000), "01:30");
    assert.equal(s.waitingFor(s.tables["2"], 400000 + 3600 * 1000), "1:01:00");
    assert.equal(s.waitingFor(s.tables["3"]), null, "no creation time");
});

console.log("\n" + passed + " passed" + (process.exitCode ? ", some FAILED" : ""));
