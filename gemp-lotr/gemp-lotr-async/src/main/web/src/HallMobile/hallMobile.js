// The mobile game hall (hall-mobile.html): your games, the tables to join or watch, creating a table, the hall chat.
//
// It uses the desktop hall's server calls (communication.js) and polls the hall the same way (hallUi.js): a full
// snapshot, then long-polled updates. When one of your games starts, it opens on the mobile game screen.
// Everything else the desktop hall has (events, tournaments, account, help) is linked from the More tab and opens in
// the standard view.

var MobileHall = (function () {

    var RETRY_MS = [2000, 4000, 8000, 15000, 30000];

    // ---- Small DOM helpers (as in the game screen's render.js) ----

    function h(tag, attrs, children) {
        var el = document.createElement(tag);
        for (var name in attrs || {}) {
            var value = attrs[name];
            if (value == null || value === false)
                continue;
            if (name == "class")
                el.className = value;
            else if (name == "text")
                el.textContent = value;
            else if (name == "html")
                el.innerHTML = value;
            else if (name.indexOf("on") == 0)
                el.addEventListener(name.substring(2), value);
            else
                el.setAttribute(name, value === true ? "" : value);
        }
        (Array.isArray(children) ? children : [children]).forEach(function (child) {
            if (child != null && child !== false)
                el.appendChild(typeof child == "string" ? document.createTextNode(child) : child);
        });
        return el;
    }

    function clear(el) {
        while (el.firstChild)
            el.removeChild(el.firstChild);
    }

    function remember(key, value) {
        try {
            localStorage.setItem("gemp-mobile-hall-" + key, value);
        } catch (e) {
            // not kept
        }
    }

    function recall(key) {
        try {
            return localStorage.getItem("gemp-mobile-hall-" + key);
        } catch (e) {
            return null;
        }
    }

    // ---- The hall ----

    function Hall() {
        this.state = new MobileHallState();
        this.tab = "hall";
        this.loaded = false;
        this.failures = 0;
        this.stopped = null;            // why the hall stopped updating
        this.playerName = null;
        this.formats = null;            // from /deck/formats
        this.timers = [];
        this.decks = null;              // [{name, format, source: "player" | "library"}]
        this.showFinished = false;

        var that = this;
        this.comm = new GempLotrCommunication("/gemp-lotr-server", function (xhr) {
            that.pollFailed(xhr);
        });
        var chatComm = new GempLotrCommunication("/gemp-lotr-server", function () {
            that.chat.stop("The chat stopped working. Reload the page to restart it.");
        });
        this.chat = new MobileChat(chatComm, "Game Hall", function () {
            that.renderChatBits();
        });

        this.main = document.getElementById("mh-main");
        this.sheet = new Sheet(document.getElementById("mg-sheet"));
        document.getElementById("mh-app").addEventListener("click", function (e) {
            that.handleTap(e);
        });
        this.sheet.body.addEventListener("click", function (e) {
            that.handleTap(e);
        });
        // The waiting tables' timers
        setInterval(function () {
            that.updateAges();
        }, 1000);
    }

    Hall.prototype.start = function () {
        var that = this;
        this.render();
        this.comm.getPlayerInfo(function (json) {
            that.playerName = json && json.name;
            that.render();
        }, {"401": function () {
            that.loggedOut();
        }});
        this.getHall();
        this.chat.start();
    };

    // ---- Talking to the server ----

    Hall.prototype.getHall = function () {
        var that = this;
        this.comm.getHall(function (xml) {
            that.process(xml, true);
        }, function (xhr) {
            that.pollFailed(xhr);
        });
    };

    Hall.prototype.updateHall = function () {
        var that = this;
        this.comm.updateHall(function (xml) {
            that.process(xml, false);
        }, this.state.channelNumber, function (xhr) {
            that.pollFailed(xhr);
        });
    };

    Hall.prototype.process = function (xml, full) {
        var root = xml && xml.documentElement;
        if (!root || root.tagName != "hall")
            return this.schedule(1000, full);
        this.failures = 0;
        this.loaded = true;
        this.state.apply(MobileHallState.fromXml(root), full);
        // One of your games just started: open it (the desktop hall opens it in a new window). A full snapshot also
        // lists games that are still running; those wait under "Your games", so leaving a game for the hall works.
        if (!full && this.state.newGames.length > 0) {
            window.location.href = "game-mobile.html?gameId=" + encodeURIComponent(this.state.newGames[0]);
            return;
        }
        this.render();
        this.schedule(100, false);
    };

    Hall.prototype.schedule = function (delay, full) {
        var that = this;
        clearTimeout(this.timer);
        if (this.stopped)
            return;
        this.timer = setTimeout(function () {
            if (full || that.state.channelNumber == null)
                that.getHall();
            else
                that.updateHall();
        }, delay);
    };

    Hall.prototype.pollFailed = function (xhr) {
        var status = xhr ? xhr.status : 0;
        if (status == 401)
            return this.loggedOut();
        if (status == 409)
            return this.stop("The game hall is open in another window or tab, so it stopped updating here.");
        if (status == 410)
            return this.schedule(100, true);    // dropped after a long silence (a sleeping phone): join again
        this.failures++;
        if (this.failures > RETRY_MS.length)
            return this.stop("Can't reach the server. Check your internet connection.");
        this.renderConnection("Reconnecting…");
        this.schedule(RETRY_MS[this.failures - 1], true);
    };

    Hall.prototype.stop = function (reason) {
        this.stopped = reason;
        clearTimeout(this.timer);
        this.render();
    };

    Hall.prototype.loggedOut = function () {
        window.location.href = "index.html";
    };

    // Answers to create / join: <error message="..."> or an HTTP error is a failure, anything else succeeded
    Hall.prototype.respond = function (onSuccess, onFailure) {
        var failed = function (xhr) {
            var message = null;
            try {
                var json = JSON.parse(xhr.responseText);
                message = json.error || json.message;
            } catch (e) {
                // not JSON
            }
            message = message || (xhr && xhr.getResponseHeader && xhr.getResponseHeader("message"));
            onFailure(message || (xhr && xhr.status == 0 ? "Can't reach the server." : "Something went wrong (" + (xhr && xhr.status) + ")."));
        };
        var errorMap = {};
        ["0", "400", "401", "403", "404", "409", "410", "500", "502", "503"].forEach(function (code) {
            errorMap[code] = failed;
        });
        return {
            callback: function (xml) {
                var root = xml && xml.documentElement;
                if (root && root.tagName == "error")
                    onFailure(root.getAttribute("message") || "That didn't work.");
                else
                    onSuccess();
            },
            errorMap: errorMap
        };
    };

    // Formats, timers and decks, loaded when a form needs them
    Hall.prototype.loadChoices = function (done) {
        var that = this;
        var pending = 3;
        var finish = function () {
            if (--pending == 0)
                done();
        };
        var readDecks = function (xml, source) {
            var root = xml && xml.documentElement;
            var list = root ? root.getElementsByTagName("deck") : [];
            var decks = [];
            for (var i = 0; i < list.length; i++)
                decks.push({name: list[i].textContent, format: list[i].getAttribute("targetFormat"), source: source});
            return decks;
        };
        var player = [];
        var library = [];
        var quiet = {"0": finish, "400": finish, "401": finish, "403": finish, "404": finish, "500": finish};
        this.comm.getFormats(true, function (json) {
            that.formats = json.Formats || {};
            that.timers = json.HallTimers || [];
            finish();
        }, quiet);
        this.comm.getDecks(function (xml) {
            player = readDecks(xml, "player");
            that.decks = player.concat(library);
            finish();
        }, quiet);
        this.comm.getLibraryDecks(function (xml) {
            library = readDecks(xml, "library");
            that.decks = player.concat(library);
            finish();
        }, quiet);
    };

    // The formats a casual table can use, in the desktop hall's order
    Hall.prototype.hallFormats = function () {
        var formats = this.formats || {};
        return Object.keys(formats).filter(function (code) {
            return formats[code].hall;
        }).sort(function (a, b) {
            return (formats[a].order || 0) - (formats[b].order || 0);
        }).map(function (code) {
            return {code: code, name: formats[code].name};
        });
    };

    // ---- Taps ----

    Hall.prototype.handleTap = function (e) {
        var target = e.target.closest("[data-action], [data-tab]");
        if (!target)
            return;
        if (target.hasAttribute("data-tab")) {
            this.showTab(target.getAttribute("data-tab"));
            return;
        }
        var action = target.getAttribute("data-action");
        var id = target.getAttribute("data-id");
        var handler = this.actions[action];
        if (handler) {
            e.preventDefault();
            handler.call(this, id, target);
        }
    };

    Hall.prototype.showTab = function (tab) {
        this.tab = tab;
        this.chat.open = tab == "chat";
        if (tab == "chat")
            this.chat.markRead();
        this.render();
        this.main.scrollTop = 0;
    };

    Hall.prototype.actions = {
        play: function (id) {
            var table = this.state.tables[id];
            if (table && table.gameId)
                window.location.href = "game-mobile.html?gameId=" + encodeURIComponent(table.gameId);
        },
        watch: function (id) {
            this.actions.play.call(this, id);
        },
        leave: function (id) {
            // The table disappears with the next hall update; a failure (the table already started) needs no message
            this.comm.leaveTable(id, this.respond(function () {
            }, function () {
            }).errorMap);
        },
        join: function (id) {
            this.showJoin(id);
        },
        menu: function () {
            this.showTab("more");
        },
        "toggle-finished": function () {
            this.showFinished = !this.showFinished;
            this.render();
        },
        "standard-view": function () {
            GempView.switchTo("standard", "hall.html");
        },
        logout: function () {
            this.comm.logout(function () {
                window.location.href = "index.html";
            }, {"0": function () {
                window.location.href = "index.html";
            }});
        },
        reload: function () {
            window.location.reload();
        }
    };

    // ---- Drawing ----

    Hall.prototype.render = function () {
        var scroll = this.main.scrollTop;
        clear(this.main);
        var nav = document.querySelectorAll("#mh-nav [data-tab]");
        for (var i = 0; i < nav.length; i++)
            nav[i].classList.toggle("mh-active", nav[i].getAttribute("data-tab") == this.tab);
        this.renderConnection();
        this.renderChatBits();

        if (this.stopped)
            this.main.appendChild(h("div", {class: "mg-banner mh-stopped"}, [this.stopped + " ",
                h("button", {type: "button", class: "mg-button", "data-action": "reload", text: "Reload"})]));

        if (this.tab == "hall")
            this.renderHall();
        else if (this.tab == "play")
            this.renderPlay();
        else if (this.tab == "chat")
            this.renderChat();
        else
            this.renderMore();
        if (this.tab == "hall")
            this.main.scrollTop = scroll;
    };

    Hall.prototype.renderConnection = function (text) {
        var el = document.getElementById("mh-connection");
        el.className = "mh-connection " + (this.stopped ? "mh-off" : text ? "mh-retry" : this.loaded ? "mh-on" : "");
        el.textContent = this.stopped ? "Offline" : text || (this.loaded ? "Connected" : "Connecting…");
    };

    Hall.prototype.renderHall = function () {
        var s = this.state;
        var main = this.main;
        if (s.motd)
            main.appendChild(h("div", {class: "mh-motd", html: s.motd}));
        if (!this.loaded) {
            main.appendChild(h("p", {class: "mg-note mh-pad", text: "Loading the game hall…"}));
            return;
        }

        var mine = s.myTables();
        if (mine.length > 0)
            main.appendChild(this.section("Your games", mine, "mh-mine"));

        main.appendChild(this.section("Waiting for an opponent", s.otherTables("WAITING"), null,
            "No tables are waiting. Create one in Play."));
        main.appendChild(this.section("Being played", s.otherTables("PLAYING"), null, "No games are being played."));

        var finished = s.otherTables("FINISHED");
        if (finished.length > 0) {
            main.appendChild(h("button", {type: "button", class: "mh-section-toggle", "data-action": "toggle-finished"},
                (this.showFinished ? "▾ " : "▸ ") + "Finished (" + finished.length + ")"));
            if (this.showFinished)
                main.appendChild(this.section(null, finished));
        }
        if (s.eventCount > 0)
            main.appendChild(h("p", {class: "mg-note mh-pad"}, [
                "Events and tournaments (" + s.eventCount + ") are in the ",
                h("a", {href: "hall.html?view=standard#events", text: "standard hall"}), "."
            ]));
    };

    Hall.prototype.section = function (title, tables, extraClass, emptyText) {
        var list = h("div", {class: "mh-tables"});
        for (var i = 0; i < tables.length; i++)
            list.appendChild(this.tableCard(tables[i]));
        if (tables.length == 0 && emptyText)
            list.appendChild(h("p", {class: "mg-note", text: emptyText}));
        return h("section", {class: "mh-section " + (extraClass || "")}, [
            title ? h("h3", {class: "mg-zone-label"}, [title, h("span", {class: "mg-zone-count", text: "" + tables.length})]) : null,
            list
        ]);
    };

    var ACTION_LABELS = {leave: "Leave", join: "Join", play: "Play", watch: "Watch"};

    Hall.prototype.tableCard = function (table) {
        var action = MobileHallState.action(table);
        var note = MobileHallState.note(table);
        var status = table.status == "WAITING"
            ? h("span", {}, ["Waiting ", h("span", {class: "mh-age", "data-created": "" + (table.createdAt || ""), text: this.state.waitingFor(table) || ""})])
            : h("span", {text: table.status == "FINISHED" && table.winner ? "Winner: " + table.winner : table.statusDescription});
        return h("div", {class: "mh-table" + (table.playing ? " mh-yours" : "") + (table.invitedYou ? " mh-invited" : "")}, [
            h("div", {class: "mh-table-text"}, [
                h("div", {class: "mh-format", text: table.format}),
                h("div", {class: "mh-info", text: [table.tournament, note].filter(Boolean).join(" · ")}),
                h("div", {class: "mh-players", text: table.players.length > 0 ? table.players.join(" vs ") : "No players yet"}),
                h("div", {class: "mh-status"}, status)
            ]),
            action ? h("button", {type: "button", class: "mg-button" + (action == "play" || action == "join" ? " mg-primary" : ""),
                "data-action": action, "data-id": table.id, text: ACTION_LABELS[action]}) : null
        ]);
    };

    Hall.prototype.updateAges = function () {
        var that = this;
        var ages = this.main.querySelectorAll(".mh-age[data-created]");
        for (var i = 0; i < ages.length; i++) {
            var createdAt = parseInt(ages[i].getAttribute("data-created"));
            if (!isNaN(createdAt))
                ages[i].textContent = that.state.waitingFor({createdAt: createdAt});
        }
    };

    // ---- Play: create a table, or practise against the bot ----

    Hall.prototype.renderPlay = function () {
        var that = this;
        var main = this.main;
        if (this.decks == null) {
            main.appendChild(h("p", {class: "mg-note mh-pad", text: "Loading your decks and the formats…"}));
            this.loadChoices(function () {
                if (that.tab == "play")
                    that.render();
            });
            return;
        }

        var formats = this.hallFormats();
        var formatSelect = h("select", {class: "mh-select", "aria-label": "Format"});
        formats.forEach(function (f) {
            formatSelect.appendChild(h("option", {value: f.code, text: f.name}));
        });
        formatSelect.value = recall("format") || (formats[0] && formats[0].code) || "";

        var deckSelect = this.deckSelect(recall("deck"));
        var timerSelect = h("select", {class: "mh-select", "aria-label": "Timer"});
        this.timers.forEach(function (t) {
            timerSelect.appendChild(h("option", {value: t.code, text: t.name}));
        });
        timerSelect.value = recall("timer") || "default";
        var timerNote = h("div", {class: "mg-note"});
        var showTimer = function () {
            var timer = that.timers.filter(function (t) {
                return t.code == timerSelect.value;
            })[0];
            timerNote.textContent = timer ? timer.description : "";
        };
        timerSelect.addEventListener("change", showTimer);
        showTimer();

        var description = h("input", {type: "text", class: "mg-chat-input", maxlength: "100", placeholder: "Note for the table (optional)"});
        var privateBox = h("input", {type: "checkbox"});
        var result = h("div", {class: "mh-result"});

        var create = function () {
            var deck = that.selectedDeck(deckSelect);
            if (!deck)
                return that.showResult(result, "Choose a deck first.", true);
            remember("format", formatSelect.value);
            remember("deck", deckSelect.value);
            remember("timer", timerSelect.value);
            that.showResult(result, "Creating the table…", false);
            var r = that.respond(function () {
                that.showResult(result, "Table created. It waits in the hall until an opponent joins.", false);
                that.showTab("hall");
            }, function (message) {
                that.showResult(result, message, true);
            });
            that.comm.createTable(formatSelect.value, deck.name, timerSelect.value || "default", description.value.trim(),
                privateBox.checked, false, r.callback, r.errorMap, deck.source);
        };

        var botDeckSelect = this.deckSelect(recall("botDeck"), "Fellowship Block");
        var botResult = h("div", {class: "mh-result"});
        var practise = function () {
            var deck = that.selectedDeck(botDeckSelect);
            if (!deck)
                return that.showResult(botResult, "Choose a deck first.", true);
            remember("botDeck", botDeckSelect.value);
            that.showResult(botResult, "Starting the game…", false);
            var r = that.respond(function () {
                that.showResult(botResult, "Starting… the game opens in a moment.", false);
            }, function (message) {
                that.showResult(botResult, message, true);
            });
            // The bot plays a random Fellowship Block starter deck
            that.comm.createSoloTable("fotr_block", deck.name, "", false, r.callback, r.errorMap, deck.source);
        };

        main.appendChild(h("section", {class: "mh-form"}, [
            h("h3", {class: "mg-zone-label", text: "Create a table"}),
            h("label", {class: "mh-field"}, ["Format", formatSelect]),
            h("label", {class: "mh-field"}, ["Deck", deckSelect]),
            h("label", {class: "mh-field"}, ["Timer", timerSelect, timerNote]),
            h("label", {class: "mh-field"}, ["Note", description]),
            h("label", {class: "mg-toggle"}, [privateBox, h("span", {}, ["Private", h("small", {text: "Others can't watch your game."})])]),
            h("button", {type: "button", class: "mg-button mg-primary mh-wide", onclick: create, text: "Create table"}),
            result
        ]));
        main.appendChild(h("section", {class: "mh-form"}, [
            h("h3", {class: "mg-zone-label", text: "Practise against the bot"}),
            h("p", {class: "mg-note", text: "Fellowship Block, against a starter deck. Choose one of your Fellowship Block decks or a library deck."}),
            h("label", {class: "mh-field"}, ["Your deck", botDeckSelect]),
            h("button", {type: "button", class: "mg-button mh-wide", onclick: practise, text: "Play against the bot"}),
            botResult
        ]));
        if (this.decks.length == 0)
            main.appendChild(h("p", {class: "mg-note mh-pad"}, ["You have no decks yet. ",
                h("a", {href: "deckBuild.html", text: "Open the deck builder"}), " to make one."]));
    };

    // Your decks, then the Deck Library's; onlyFormat: only decks made for that format
    Hall.prototype.deckSelect = function (selected, onlyFormat) {
        var select = h("select", {class: "mh-select", "aria-label": "Deck"});
        select.appendChild(h("option", {value: "", text: "Choose a deck…"}));
        var groups = {player: h("optgroup", {label: "Your decks"}), library: h("optgroup", {label: "Deck Library"})};
        (this.decks || []).forEach(function (deck, i) {
            if (onlyFormat && deck.format != onlyFormat)
                return;
            groups[deck.source].appendChild(h("option", {value: deck.source + ":" + deck.name, text: deck.name + (deck.format ? "  [" + deck.format + "]" : "")}));
        });
        ["player", "library"].forEach(function (source) {
            if (groups[source].childNodes.length > 0)
                select.appendChild(groups[source]);
        });
        if (selected && select.querySelector("option[value=\"" + selected.replace(/"/g, "\\\"") + "\"]"))
            select.value = selected;
        return select;
    };

    Hall.prototype.selectedDeck = function (select) {
        var value = select.value;
        if (!value)
            return null;
        var colon = value.indexOf(":");
        return {source: value.substring(0, colon), name: value.substring(colon + 1)};
    };

    Hall.prototype.showResult = function (el, text, error) {
        el.textContent = text;
        el.className = "mh-result" + (error ? " mh-error" : "");
    };

    // ---- Joining a table ----

    Hall.prototype.showJoin = function (tableId) {
        var that = this;
        var table = this.state.tables[tableId];
        if (!table)
            return;
        var open = function () {
            that.sheet.open("Join table", function (body) {
                var deckSelect = that.deckSelect(recall("deck:" + table.format) || recall("deck"), table.format);
                if (deckSelect.options.length <= 1)
                    deckSelect = that.deckSelect(recall("deck"));
                var result = h("div", {class: "mh-result"});
                var join = function () {
                    var deck = that.selectedDeck(deckSelect);
                    if (!deck)
                        return that.showResult(result, "Choose a deck first.", true);
                    remember("deck:" + table.format, deckSelect.value);
                    that.showResult(result, "Joining…", false);
                    var r = that.respond(function () {
                        that.showResult(result, "Joined. The game opens in a moment.", false);
                    }, function (message) {
                        that.showResult(result, message, true);
                    });
                    that.comm.joinTable(tableId, deck.name, r.callback, r.errorMap, deck.source);
                };
                body.appendChild(h("div", {class: "mh-table"}, h("div", {class: "mh-table-text"}, [
                    h("div", {class: "mh-format", text: table.format}),
                    h("div", {class: "mh-info", text: [table.tournament, MobileHallState.note(table)].filter(Boolean).join(" · ")}),
                    h("div", {class: "mh-players", text: "Against " + table.players.join(", ")})
                ])));
                body.appendChild(h("label", {class: "mh-field"}, ["Your deck", deckSelect]));
                body.appendChild(h("button", {type: "button", class: "mg-button mg-primary mh-wide", onclick: join, text: "Join table"}));
                body.appendChild(result);
            });
        };
        if (this.decks == null)
            this.loadChoices(open);
        else
            open();
    };

    // ---- Chat ----

    Hall.prototype.renderChat = function () {
        var chat = this.chat;
        var log = h("div", {class: "mg-chat-log mh-chat-log"});
        var input = h("input", {type: "text", class: "mg-chat-input", placeholder: chat.broken ? "Chat is off" : "Message the game hall…",
            maxlength: "500", disabled: !!chat.broken, enterkeyhint: "send", "aria-label": "Message"});
        var form = h("form", {class: "mg-chat-form mh-chat-form"}, [input,
            h("button", {type: "submit", class: "mg-button mg-primary", disabled: !!chat.broken, text: "Send"})]);
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            chat.send(input.value);
            input.value = "";
        });
        this.chatLog = log;
        this.chatUsers = h("div", {class: "mg-note mg-chat-users"});
        this.main.appendChild(h("section", {class: "mh-chat"}, [this.chatUsers, log, form]));
        this.fillChat(true);
    };

    Hall.prototype.fillChat = function (toBottom) {
        var chat = this.chat;
        var log = this.chatLog;
        if (!log || !log.isConnected)
            return;
        var atBottom = toBottom || this.main.scrollHeight - this.main.scrollTop - this.main.clientHeight < 40;
        clear(log);
        chat.messages.forEach(function (m) {
            log.appendChild(h("div", {class: "mg-msg mg-chat-" + m.kind}, [m.from ? h("b", {text: m.from + ": "}) : null, h("span", {html: m.text})]));
        });
        if (chat.messages.length == 0)
            log.appendChild(h("p", {class: "mg-note", text: "No messages yet."}));
        this.chatUsers.textContent = chat.users.length > 0 ? chat.users.length + " in the hall: " + chat.users.join(", ") : "";
        chat.markRead();
        if (atBottom)
            this.main.scrollTop = this.main.scrollHeight;
    };

    // New chat messages: the badge on the Chat tab, or the open chat
    Hall.prototype.renderChatBits = function () {
        if (this.tab == "chat")
            this.fillChat(false);
        var badge = document.querySelector("#mh-nav .mh-badge");
        badge.hidden = this.chat.unread == 0;
        badge.textContent = "" + this.chat.unread;
    };

    // ---- More ----

    Hall.prototype.renderMore = function () {
        var link = function (href, label) {
            return h("a", {class: "mg-button", href: href, text: label});
        };
        this.main.appendChild(h("section", {class: "mh-form"}, [
            this.playerName ? h("p", {class: "mg-note", text: "Logged in as " + this.playerName}) : null,
            h("div", {class: "mg-menu"}, [
                link("deckBuild.html", "Deck builder"),
                link("hall.html?view=standard#events", "Events and tournaments"),
                link("hall.html?view=standard#account", "My account"),
                link("hall.html?view=standard#info", "Server info"),
                link("hall.html?view=standard#help", "Help"),
                link("https://wiki.lotrtcgpc.net/", "LotR-TCG wiki"),
                h("button", {type: "button", class: "mg-button", "data-action": "standard-view", text: "Switch to the standard view"}),
                h("button", {type: "button", class: "mg-button mg-danger", "data-action": "logout", text: "Log out"})
            ]),
            h("p", {class: "mg-note", text: "These pages open in the standard view, made for bigger screens."})
        ]));
    };

    // ---- Bottom sheet (as on the game screen) ----

    function Sheet(root) {
        this.root = root;
        this.title = root.querySelector(".mg-sheet-title");
        this.body = root.querySelector(".mg-sheet-body");
        var that = this;
        root.querySelector(".mg-sheet-close").addEventListener("click", function () {
            that.close();
        });
        root.querySelector(".mg-sheet-backdrop").addEventListener("click", function () {
            that.close();
        });
    }

    Sheet.prototype.open = function (title, build) {
        this.title.textContent = title;
        clear(this.body);
        build(this.body);
        this.root.hidden = false;
    };

    Sheet.prototype.close = function () {
        this.root.hidden = true;
        clear(this.body);
    };

    return Hall;
})();

document.addEventListener("DOMContentLoaded", function () {
    window.mobileHall = new MobileHall();
    window.mobileHall.start();
});
