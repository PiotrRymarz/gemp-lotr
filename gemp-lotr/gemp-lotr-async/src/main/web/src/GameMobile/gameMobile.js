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

    // After a dropped connection: wait 2, 4, 8, 16, 30, 30 seconds between attempts, then give up
    var RECONNECT_ATTEMPTS = 6;

    var TITLE = "GEMP: LotR-TCG - Game Table";
    var YOUR_MOVE_TITLE = "▶ Your move - GEMP";

    function MobileGame() {
        this.gameId = getUrlParam("gameId");
        this.replayId = getUrlParam("replayId");
        this.mode = this.replayId != null ? "replay" : "live";
        this.state = new MobileGameState();
        this.channelNumber = null;
        this.stopped = false;
        this.reconnectAttempts = 0;
        this.settings = new MobileSettings();
        this.endShown = false;

        var that = this;
        var standardViewUrl = "game.html" + window.location.search;
        this.comm = new GempLotrCommunication("/gemp-lotr-server", function (xhr) {
            that.connectionLost(xhr);
        });
        if (this.mode == "live" && this.gameId != null) {
            // Its own connection, so a chat problem never stops the game
            var chatComm = new GempLotrCommunication("/gemp-lotr-server", function () {
                that.chat.stop("The chat stopped working. Reload the page to restart it.");
            });
            this.chat = new MobileChat(chatComm, "Game" + this.gameId, function () {
                that.renderer.render();
            });
        }
        this.renderer = new MobileRenderer(this.state, {
            mode: this.mode,
            standardViewUrl: standardViewUrl,
            settings: this.settings,
            chat: this.chat || null,
            loadModifiers: this.mode == "live" ? function (cardId, callback) {
                that.comm.getGameCardModifiers(cardId, callback);
            } : null,
            onReplay: function (command) {
                that.replayCommand(command);
            },
            onConcede: function () {
                that.comm.concede(that.errorMap());
                that.pollWhileDeciding();
            },
            onCancelRequest: function () {
                that.comm.cancel(that.errorMap());
                that.state.addMessage("You asked to cancel the game. It is cancelled if your opponent asks too.", "warning");
                that.renderer.render();
                that.pollWhileDeciding();
            },
            onSettingsChanged: function () {
                if (that.renderer.decision)
                    that.renderer.decision.autoAccept = that.settings.autoAccept;
            }
        });

        document.addEventListener("visibilitychange", function () {
            // Back from the background (the phone was asleep, another app was open): reconnect now if we were waiting to
            if (!document.hidden && that.reconnectTimer) {
                clearTimeout(that.reconnectTimer);
                that.reconnectTimer = null;
                that.resync();
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
                that.chat.start();
            }, this.errorMap());
            this.startClockTick();
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
            if (this.state.ended && !this.endShown) {
                this.endShown = true;
                this.renderer.showGameOver();
            }
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
            document.title = TITLE;
            return;
        }
        if (current && current.id == decision.id && !current.sent)
            return;

        // Searching your own deck shows the whole deck first; the player may have asked to skip that (desktop setting)
        if (decision.type == "ARBITRARY_CARDS" && this.settings.autoDismissDeckReveal
            && decision.params.deckInspection && decision.params.deckInspection[0] == "own") {
            this.renderer.decision = null;
            this.answer(decision.id, "");
            return;
        }

        var that = this;
        this.renderer.decision = MobileDecisions.create(decision, this.state, function (value) {
            that.answer(decision.id, value);
        }, {autoAccept: this.settings.autoAccept});
        this.yourMove();
    };

    // A decision arrived: the page title says so, the phone vibrates, and a sound plays if the page is in the background
    MobileGame.prototype.yourMove = function () {
        document.title = YOUR_MOVE_TITLE;
        if (this.settings.vibrate && navigator.vibrate)
            navigator.vibrate(60);
        if (this.settings.sound && document.hidden)
            playSound("/gemp-lotr/src/assets/awaiting_decision.mp3");
    };

    function playSound(url) {
        try {
            var promise = new Audio(url).play();
            if (promise !== undefined)
                promise.catch(function () {
                });     // browsers refuse sound before the first tap: not an error
        } catch (e) {
            // no sound
        }
    }

    MobileGame.prototype.answer = function (decisionId, value) {
        var that = this;
        this.comm.gameDecisionMade(decisionId, value, this.channelNumber, function (xml) {
            that.processXml(xml);
        }, this.errorMap());
    };

    // ---- Clocks ----

    // The server sends clock values with each response; in between, the clocks of a pending decision of ours are
    // counted down here every second (like the desktop client's startTimerTick)
    MobileGame.prototype.startClockTick = function () {
        var that = this;
        this.clockTimer = setInterval(function () {
            that.clockTick();
        }, 1000);
    };

    MobileGame.prototype.clockTick = function () {
        var s = this.state;
        var d = this.renderer.decision;
        if (s.ended || this.stopped || !d || d.sent || s.spectator) {
            if (s.ended)
                clearInterval(this.clockTimer);
            return;
        }
        var me = s.bottomPlayerId;
        if (s.clocks[me] != null)
            s.clocks[me] -= 1;
        if (s.decisionClock != null)
            s.decisionClock += 1;
        this.renderer.updateClocks();
        this.timerCues();
    };

    // Seconds left before the pending decision times out, or null if the limit isn't known
    MobileGame.prototype.decisionRemaining = function () {
        var s = this.state;
        if (!s.decisionLimit || s.decisionLimit <= 0 || s.decisionClock == null)
            return null;
        return s.decisionLimit - s.decisionClock;
    };

    // Warnings when time runs low: the decision clock at 60, 30 and 10 seconds and every second below 10;
    // the time bank every 30 seconds below 5 minutes and every 10 seconds below 1 minute
    MobileGame.prototype.timerCues = function () {
        if (!this.settings.timerAlerts)
            return;
        var remaining = this.decisionRemaining();
        var bank = this.state.clocks[this.state.bottomPlayerId];
        var cue = (remaining != null && (remaining == 60 || remaining == 30 || (remaining > 0 && remaining <= 10)))
            || (bank != null && bank > 0 && ((bank < 300 && bank % 30 == 0) || (bank < 60 && bank % 10 == 0)));
        if (!cue)
            return;
        if (this.settings.vibrate && navigator.vibrate)
            navigator.vibrate(40);
        if (this.settings.sound)
            playSound("/gemp-lotr/src/assets/timer_alert.mp3");
    };

    // Polling pauses while one of our decisions waits; after conceding (or asking to cancel) the game may end
    // without that decision being answered, so listen for it
    MobileGame.prototype.pollWhileDeciding = function () {
        if (this.state.decision == null)
            return;     // already polling
        var that = this;
        setTimeout(function () {
            that.poll();
        }, 500);
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
                // No answer at all: the network dropped, the phone slept, or the request timed out
                that.reconnect();
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
                // Right after reconnecting the server may still see our old connection: try again
                if (that.reconnectAttempts > 0)
                    that.reconnect();
                else
                    that.showProblem("You have this game open somewhere else. Close it there, or reload here to watch it here.");
            },
            "410": function () {
                // Removed for inactivity (a phone in a pocket): just join the game again
                that.reconnect();
            }
        };
    };

    // ---- Reconnecting ----

    MobileGame.prototype.reconnect = function () {
        if (this.mode != "live" || this.stopped)
            return this.showProblem("Can't reach the server. Check your internet connection, then reload the page.");
        this.reconnectAttempts++;
        if (this.reconnectAttempts > RECONNECT_ATTEMPTS)
            return this.showProblem("Can't reach the server. Check your internet connection, then reload the page.");
        var delay = Math.min(30, Math.pow(2, this.reconnectAttempts)) * 1000;
        this.renderer.status = {text: "Connection lost. Reconnecting…", kind: "info"};
        this.renderer.render();
        var that = this;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(function () {
            that.reconnectTimer = null;
            that.resync();
        }, document.hidden ? delay : Math.min(delay, 4000));
    };

    // Loads the whole game again, as reloading the page would (a decision in progress is asked again by the server)
    MobileGame.prototype.resync = function () {
        var that = this;
        this.comm.startGameSession(function (xml) {
            that.reconnectAttempts = 0;
            that.state = new MobileGameState();
            that.renderer.state = that.state;
            that.renderer.decision = null;
            that.renderer.status = null;
            that.processXml(xml);
        }, this.errorMap());
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
