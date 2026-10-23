// The mobile game screen: loads a live game (game-mobile.html?gameId=...) or a replay (?replayId=...),
// feeds the server's events into a MobileGameState and draws it with a MobileRenderer.
//
// A player answers their decisions here (decisions.js); spectators and replays only watch. The server calls are the
// desktop client's (communication.js), so nothing changes on the server.

var MobileGame = (function () {

    // Replay steps that change the table get a pause so they can be followed; the rest play at once
    var REPLAY_STEP_MS = {PCIP: 650, MCIP: 650, RCFP: 500, FCIP: 400, AA: 500, RA: 300, SS: 800, ES: 500,
        ATS: 400, RFS: 400, EP: 1400, CAC: 1100, CA: 700, D: 900, TC: 600, PP: 500};
    var REPLAY_SPEEDS = [1, 2, 4, 0.5];

    function MobileGame() {
        this.gameId = getUrlParam("gameId");
        this.replayId = getUrlParam("replayId");
        this.mode = this.replayId != null ? "replay" : "live";
        this.state = new MobileGameState();
        this.channelNumber = null;
        this.stopped = false;

        var that = this;
        var standardViewUrl = "game.html" + window.location.search;
        this.comm = new GempLotrCommunication("/gemp-lotr-server", function (xhr) {
            that.connectionLost(xhr);
        });
        this.renderer = new MobileRenderer(this.state, {
            mode: this.mode,
            standardViewUrl: standardViewUrl,
            loadModifiers: this.mode == "live" ? function (cardId, callback) {
                that.comm.getGameCardModifiers(cardId, callback);
            } : null,
            onReplay: function (command) {
                that.replayCommand(command);
            }
        });
    }

    MobileGame.prototype.start = function () {
        var that = this;
        this.renderer.render();
        if (this.mode == "replay") {
            this.comm.getReplay(this.replayId, function (xml) {
                that.startReplay(xml);
            }, this.errorMap());
        } else if (this.gameId != null) {
            this.comm.startGameSession(function (xml) {
                that.processXml(xml);
            }, this.errorMap());
        } else {
            this.showProblem("No game was given. Open a game from the game hall.");
        }
    };

    // ---- Live game ----

    MobileGame.prototype.processXml = function (xml) {
        var root = xml.documentElement;
        if (root.tagName != "gameState" && root.tagName != "update")
            return;
        try {
            this.channelNumber = root.getAttribute("cn");
            var events = root.getElementsByTagName("ge");
            if (events.length > 0)
                this.state.beginBatch();
            for (var i = 0; i < events.length; i++)
                this.state.apply(MobileGameState.eventFromXml(events[i]));
            this.state.applyClocks(readClocks(root));
            this.updateDecision();
            this.renderer.render();
        } catch (e) {
            console.log(e);
            this.showProblem("There was an error while showing the game. Reload the page to continue.");
            return;
        }

        // Like the desktop client: no polling while one of our decisions waits for an answer
        if (this.state.ended || this.state.decision != null)
            return;
        var that = this;
        setTimeout(function () {
            that.poll();
        }, 100);
    };

    // A new decision for this player gets its own answering object; the same one is kept while it is being answered
    MobileGame.prototype.updateDecision = function () {
        var decision = this.state.decision;
        var current = this.renderer.decision;
        if (decision == null || this.mode != "live" || this.state.spectator) {
            this.renderer.decision = null;
            return;
        }
        if (current && current.id == decision.id && !current.sent)
            return;
        var that = this;
        this.renderer.decision = MobileDecisions.create(decision, this.state, function (value) {
            that.answer(decision.id, value);
        });
    };

    MobileGame.prototype.answer = function (decisionId, value) {
        var that = this;
        this.comm.gameDecisionMade(decisionId, value, this.channelNumber, function (xml) {
            that.processXml(xml);
        }, this.errorMap());
    };

    MobileGame.prototype.poll = function () {
        if (this.stopped)
            return;
        var that = this;
        this.comm.updateGameState(this.channelNumber, function (xml) {
            that.processXml(xml);
        }, this.errorMap());
    };

    function readClocks(root) {
        var result = [];
        var clocks = root.getElementsByTagName("clock");
        for (var i = 0; i < clocks.length; i++)
            result.push({participantId: clocks[i].getAttribute("participantId"), value: parseInt(clocks[i].textContent)});
        return result;
    }

    // ---- Replay ----

    MobileGame.prototype.startReplay = function (xml) {
        var root = xml.documentElement;
        if (root.tagName != "gameReplay") {
            this.showProblem("This replay could not be read.");
            return;
        }
        var elements = root.getElementsByTagName("ge");
        this.replayEvents = [];
        for (var i = 0; i < elements.length; i++)
            this.replayEvents.push(MobileGameState.eventFromXml(elements[i]));
        this.replayIndex = 0;
        this.renderer.replay = {playing: false, speed: 1, position: 0, total: this.replayEvents.length};
        // Show the table as it is before the first card is played, then wait for the viewer
        this.stepUntilVisibleChange();
        this.renderer.replay.position = this.replayIndex;
        this.renderer.render();
    };

    MobileGame.prototype.replayCommand = function (command) {
        var replay = this.renderer.replay;
        if (!replay)
            return;
        if (command == "toggle") {
            replay.playing = !replay.playing;
            if (replay.playing)
                this.scheduleReplay(0);
            else
                clearTimeout(this.replayTimer);
        } else if (command == "step") {
            replay.playing = false;
            clearTimeout(this.replayTimer);
            this.stepUntilVisibleChange();
            replay.position = this.replayIndex;
        } else if (command == "speed") {
            replay.speed = REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(replay.speed) + 1) % REPLAY_SPEEDS.length];
        }
        this.renderer.options.effectScale = 1 / replay.speed;
        this.renderer.render();
    };

    // Applies events up to and including the next one that takes time to watch, plus the quick ones right after it
    // (the stats that come with a skirmish, for example); returns the pause for that step (ms)
    MobileGame.prototype.stepUntilVisibleChange = function () {
        var pause = 0;
        while (this.replayIndex < this.replayEvents.length) {
            var event = this.replayEvents[this.replayIndex];
            var eventPause = REPLAY_STEP_MS[event.type] || 0;
            if (pause > 0 && eventPause > 0)
                return pause;
            this.replayIndex++;
            this.state.beginBatch();
            this.state.apply(event);
            pause = Math.max(pause, eventPause);
        }
        this.renderer.replay.playing = false;
        return pause;
    };

    MobileGame.prototype.scheduleReplay = function (delay) {
        var that = this;
        clearTimeout(this.replayTimer);
        this.replayTimer = setTimeout(function () {
            var replay = that.renderer.replay;
            if (!replay.playing)
                return;
            var pause = that.stepUntilVisibleChange();
            replay.position = that.replayIndex;
            that.renderer.render();
            if (replay.playing)
                that.scheduleReplay(pause / replay.speed);
        }, delay);
    };

    // ---- Problems ----

    MobileGame.prototype.errorMap = function () {
        var that = this;
        return {
            "0": function () {
                that.showProblem("Can't reach the server. Check your internet connection, then reload the page.");
            },
            "401": function () {
                that.showProblem("You are not logged in. Log in on the main page, then open the game again.");
            },
            "403": function () {
                that.showProblem("This game is private and does not allow spectators.");
            },
            "404": function () {
                that.showProblem(that.mode == "replay" ? "This replay doesn't exist." : "This game doesn't exist any more. It may have finished.");
            },
            "409": function () {
                that.showProblem("You have this game open somewhere else. Close it there, or reload here to watch it here.");
            },
            "410": function () {
                that.showProblem("You were inactive for too long. Reload the page to continue.");
            }
        };
    };

    MobileGame.prototype.connectionLost = function (xhr) {
        this.showProblem("The connection to the server was lost" + (xhr && xhr.status ? " (" + xhr.status + ")" : "")
            + ". If the game has finished it was removed; otherwise reload the page to continue.");
    };

    MobileGame.prototype.showProblem = function (text) {
        this.stopped = true;
        this.renderer.status = {text: text, kind: "error"};
        this.renderer.render();
    };

    return MobileGame;
})();

document.addEventListener("DOMContentLoaded", function () {
    window.mobileGame = new MobileGame();
    window.mobileGame.start();
});
