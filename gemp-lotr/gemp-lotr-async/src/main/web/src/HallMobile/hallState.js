// The game hall for the mobile hall page: the tables the server sends, kept as plain objects.
//
// The server sends a full snapshot first (GET /hall), then changes (POST /hall/update): each <table> has an action
// "add", "update" or "remove". Read like the desktop hall does (hallUi.js drawHall / drawTable). No screen code here,
// so it can be tested in Node (mobile-client/dev/test-hall.js).
//
// Input: {attr: {...}, children: [{tag, attr}]} for the <hall> element - see MobileHallState.fromXml.

(function (root) {

    function HallState() {
        this.tables = {};           // id -> table (see readTable)
        this.nextSeq = 1;
        this.channelNumber = null;
        this.motd = null;
        this.serverTime = null;
        this.serverClockOffset = 0; // server clock minus ours, for the waiting tables' timers
        this.newGames = [];         // games that just started for this player (to open)
        this.eventCount = 0;        // queues and tournaments: shown in the standard hall only
    }

    HallState.fromXml = function (element) {
        var children = [];
        for (var i = 0; i < element.childNodes.length; i++) {
            var child = element.childNodes[i];
            if (child.nodeType == 1)
                children.push({tag: child.tagName, attr: attributesOf(child)});
        }
        return {tag: element.tagName, attr: attributesOf(element), children: children};
    };

    function attributesOf(element) {
        var attr = {};
        for (var i = 0; i < element.attributes.length; i++)
            attr[element.attributes[i].name] = element.attributes[i].value;
        return attr;
    }

    // full: a snapshot, which replaces everything known
    HallState.prototype.apply = function (hall, full, now) {
        if (hall.tag != "hall")
            return;
        var a = hall.attr;
        if (full) {
            this.tables = {};
            this.eventCount = 0;
        }
        this.channelNumber = a.channelNumber;
        if (a.motd != null)
            this.motd = a.motd;
        if (a.serverTime != null)
            this.serverTime = a.serverTime;
        var serverMs = parseInt(a.serverTimeMs);
        if (!isNaN(serverMs))
            this.serverClockOffset = serverMs - (now != null ? now : Date.now());

        this.newGames = [];
        var events = {};
        for (var i = 0; i < hall.children.length; i++) {
            var child = hall.children[i];
            if (child.tag == "table")
                this.applyTable(child.attr);
            else if (child.tag == "newGame" && child.attr.id != null)
                this.newGames.push(child.attr.id);
            else if (child.tag == "queue" || child.tag == "tournament")
                events[child.tag + child.attr.id] = child.attr.action != "remove";
        }
        for (var key in events)
            if (events[key])
                this.eventCount++;
    };

    HallState.prototype.applyTable = function (t) {
        if (t.action == "remove") {
            delete this.tables[t.id];
            return;
        }
        if (t.action != "add" && t.action != "update")
            return;
        var old = this.tables[t.id];
        this.tables[t.id] = {
            id: t.id,
            gameId: t.gameId || null,
            status: t.status,
            statusDescription: t.statusDescription || "",
            format: t.format || "",
            tournament: t.tournament || "",
            description: t.userDescription || "",
            players: t.players ? t.players.split(",") : [],
            playing: t.playing == "true",          // this player is at the table
            watchable: t.watchable == "true",
            isPrivate: t.isPrivate == "true",
            isInviteOnly: t.isInviteOnly == "true",
            invitedYou: t.invitedYou == "true",
            winner: t.winner || null,
            createdAt: t.createdAt != null ? parseInt(t.createdAt) : null,
            seq: old ? old.seq : this.nextSeq++
        };
    };

    HallState.prototype.list = function (predicate) {
        var result = [];
        for (var id in this.tables)
            if (predicate(this.tables[id]))
                result.push(this.tables[id]);
        result.sort(function (a, b) {
            return a.seq - b.seq;
        });
        return result;
    };

    // This player's tables: games in progress first, then tables waiting for an opponent
    HallState.prototype.myTables = function () {
        return this.list(function (t) {
            return t.playing && t.status != "FINISHED";
        }).sort(function (a, b) {
            return (a.status == "PLAYING" ? 0 : 1) - (b.status == "PLAYING" ? 0 : 1) || a.seq - b.seq;
        });
    };

    HallState.prototype.otherTables = function (status) {
        return this.list(function (t) {
            return t.status == status && !(t.playing && status != "FINISHED");
        });
    };

    // What can be done at a table: "leave", "join", "play", "watch" or null
    HallState.action = function (table) {
        if (table.status == "WAITING")
            return table.playing ? "leave" : (!table.isInviteOnly || table.invitedYou ? "join" : null);
        if (table.status == "PLAYING" && table.gameId)
            return table.playing ? "play" : (table.watchable ? "watch" : null);
        return null;
    };

    // The note the desktop hall shows after the table's name
    HallState.note = function (table) {
        if (table.description) {
            if (table.isInviteOnly)
                return (table.isPrivate ? "Private match for " : "Match for ") + table.description;
            return (table.isPrivate ? "Private: " : "") + table.description;
        }
        return table.isPrivate ? "Private" : "";
    };

    // "01:30": how long a table has been waiting, on the server's clock
    HallState.prototype.waitingFor = function (table, now) {
        if (table.createdAt == null)
            return null;
        var seconds = Math.max(0, Math.floor(((now != null ? now : Date.now()) + this.serverClockOffset - table.createdAt) / 1000));
        var pad = function (n) {
            return n < 10 ? "0" + n : "" + n;
        };
        var hours = Math.floor(seconds / 3600);
        return (hours > 0 ? hours + ":" : "") + pad(Math.floor(seconds / 60) % 60) + ":" + pad(seconds % 60);
    };

    root.MobileHallState = HallState;
    if (typeof module !== "undefined" && module.exports)
        module.exports = HallState;
})(typeof window !== "undefined" ? window : this);
