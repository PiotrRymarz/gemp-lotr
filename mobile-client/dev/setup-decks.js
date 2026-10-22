// Saves the decks autoplay.js expects: "Aragorn Starter" for asdf and "Gandalf Starter" for qwer (Fellowship Block).
// They are the starter decks the bots use (FotrStartersSimulation.java). Run once on a fresh local database.
//
//   node setup-decks.js [--base http://localhost]

const BASE = (process.argv.indexOf("--base") >= 0 ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost") + "/gemp-lotr-server";

const DECKS = [
    {login: "asdf", password: "asdf", name: "Aragorn Starter", contents:
        "1_290|1_2|1_320,1_327,1_340,1_346,1_349,1_351,1_355,1_358,1_361|1_365,1_365,1_92,1_94,1_94,1_97," +
        "1_97,1_101,1_104,1_104,1_106,1_107,1_107,1_296,1_296,1_299,1_299,1_51,1_108,1_108,1_110,1_110,1_309," +
        "1_311,1_116,1_116,1_116,1_117,1_117,1_117,1_121,1_121,1_121,1_133,1_133,1_141,1_141,1_145,1_150," +
        "1_150,1_150,1_150,1_151,1_151,1_151,1_152,1_152,1_152,1_152,1_153,1_153,1_153,1_153,1_154,1_154," +
        "1_154,1_157,1_157,1_158,1_158"},
    {login: "qwer", password: "qwer", name: "Gandalf Starter", contents:
        "1_290|1_2|1_326,1_331,1_337,1_345,1_349,1_350,1_353,1_359,1_360|1_70,1_97,1_286,1_286,1_286,1_37," +
        "1_37,1_364,1_364,1_12,1_12,1_296,1_296,1_299,1_76,1_76,1_76,1_51,1_51,1_78,1_78,1_78,1_78,1_304," +
        "1_304,1_84,1_312,1_26,1_26,1_86,1_168,1_168,1_168,1_176,1_176,1_176,1_176,1_177,1_178,1_178,1_178" +
        ",1_178,1_179,1_179,1_179,1_180,1_180,1_180,1_180,1_181,1_181,1_181,1_187,1_187,1_187,1_191," +
        "1_191,1_191,1_196,1_196"}
];

async function post(url, params, cookie) {
    const response = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie || ""},
        body: new URLSearchParams(params).toString()
    });
    if (!response.ok)
        throw new Error(url + " -> " + response.status + " " + (await response.text()).substring(0, 200));
    return response;
}

(async () => {
    for (const deck of DECKS) {
        const login = await post(BASE + "/login", {login: deck.login, password: deck.password});
        const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
        await post(BASE + "/deck", {deckName: deck.name, targetFormat: "fotr_block", notes: "", deckContents: deck.contents}, cookie);
        console.log("saved " + deck.name + " for " + deck.login);
    }
})().catch(e => {
    console.error("FAILED: " + e.message);
    process.exit(1);
});
