// Draws the mobile game screen from a MobileGameState.
//
// The whole screen is rebuilt on every change: it holds at most a few dozen cards, the browser keeps the card images,
// and a full rebuild can't get out of step with the state. Sideways scroll positions of the rows are kept.
// Layout (phone portrait, phone landscape, tablet) is done in index.css; this file only builds the elements.

var MobileRenderer = (function () {

    var PHASE_NAMES = {
        PUT_RING_BEARER: "Ring-bearer",
        PLAY_STARTING_FELLOWSHIP: "Starting fellowship",
        BETWEEN_TURNS: "Between turns"
    };

    var RESISTANCE_NAMES = {A: "Aragorn", F: "Frodo", G: "Gandalf", T: "Théoden"};

    var ZONE_NAMES = {
        FREE_CHARACTERS: "Characters", SUPPORT: "Support area", SHADOW_CHARACTERS: "Minions", HAND: "Hand",
        ATTACHED: "Attached", STACKED: "Stacked", ADVENTURE_PATH: "Adventure path", DISCARD: "Discard pile",
        DEAD: "Dead pile", REMOVED: "Removed from game", ADVENTURE_DECK: "Adventure deck", DECK: "Draw deck"
    };

    // ---- Small DOM helpers ----

    function h(tag, attrs, children) {
        var el = document.createElement(tag);
        if (attrs) {
            for (var name in attrs) {
                var value = attrs[name];
                if (value == null || value === false)
                    continue;
                if (name == "class")
                    el.className = value;
                else if (name == "html")
                    el.innerHTML = value;
                else if (name == "text")
                    el.textContent = value;
                else if (name.indexOf("on") == 0)
                    el.addEventListener(name.substring(2), value);
                else
                    el.setAttribute(name, value === true ? "" : value);
            }
        }
        append(el, children);
        return el;
    }

    function append(el, children) {
        if (children == null)
            return;
        if (!Array.isArray(children))
            children = [children];
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child == null || child === false)
                continue;
            el.appendChild(typeof child == "string" ? document.createTextNode(child) : child);
        }
    }

    function clear(el) {
        while (el.firstChild)
            el.removeChild(el.firstChild);
    }

    function formatPhase(phase) {
        if (phase == null)
            return "";
        if (PHASE_NAMES[phase])
            return PHASE_NAMES[phase];
        return phase.charAt(0) + phase.substring(1).toLowerCase().replace(/_/g, " ");
    }

    // Same format as the desktop clocks (gameUi.parseTime)
    function formatTime(value) {
        if (value == null)
            return "";
        var sign = value < 0 ? "-" : "";
        value = Math.abs(value);
        var hours = Math.floor(value / 3600);
        var minutes = Math.floor(value / 60) % 60;
        var seconds = value % 60;
        var pad = function (n) {
            return n < 10 ? "0" + n : "" + n;
        };
        return sign + (hours > 0 ? hours + ":" + pad(minutes) : minutes) + ":" + pad(seconds);
    }

    // ---- Card images ----

    var visualCache = {};

    // Image and orientation of a card, using the desktop client's Card model
    function cardVisual(blueprintId, zone, metaSiteVisuals) {
        var key = blueprintId + "|" + zone;
        var visual = visualCache[key];
        if (!visual) {
            var card = new Card(blueprintId, null, null, zone, null, null);
            visual = {
                imageUrl: card.imageUrl,
                backUrl: card.backSideImageUrl,
                horizontal: !!card.horizontal,
                foil: card.isFoil(),
                errata: card.hasErrata(),
                overlayUrl: null,
                label: blueprintId
            };
            var metaVisual = metaSiteVisuals && metaSiteVisuals[card.bareBlueprint];
            if (metaVisual) {
                visual.overlayUrl = visual.imageUrl;
                visual.imageUrl = Card.getImageUrl(metaVisual);
            }
            visualCache[key] = visual;
        }
        return visual;
    }

    function cardImage(url, label) {
        var img = h("img", {src: url, alt: label, loading: "lazy", draggable: "false"});
        img.addEventListener("error", function () {
            // No image (offline, or a card without one): show its id so the slot is still readable
            img.parentNode && img.parentNode.classList.add("mg-noimg");
        });
        return img;
    }

    // ---- The renderer ----

    function Renderer(state, options) {
        this.state = state;
        this.options = options || {};
        this.top = document.getElementById("mg-top");
        this.sitesEl = document.getElementById("mg-sites");
        this.zonesEl = document.getElementById("mg-zones");
        this.sideEl = document.getElementById("mg-side");
        this.handDock = document.getElementById("mg-hand-dock");
        this.bottom = document.getElementById("mg-bottom");
        this.effectEl = document.getElementById("mg-effect");
        this.sheet = new Sheet(document.getElementById("mg-sheet"));
        this.lastEffectSeq = 0;
        this.status = null;     // extra status from the controller: {text, kind}
        this.replay = null;     // replay controls from the controller
        this.decision = null;   // the decision being answered (decisions.js), live games only

        var that = this;
        // One listener for every card, site and card name in the log
        var app = document.getElementById("mg-app");
        app.addEventListener("click", function (e) {
            that.handleTap(e);
        });
        this.sheet.body.addEventListener("click", function (e) {
            that.handleTap(e);
        });
        this.listenForLongPress(app);
        this.listenForLongPress(this.sheet.body);
    }

    var LONG_PRESS_MS = 450;

    // A long press on a card always opens it, also when a tap would select it for a decision
    Renderer.prototype.listenForLongPress = function (root) {
        var that = this;
        var timer = null;
        var start = null;
        var cancel = function () {
            clearTimeout(timer);
            timer = null;
        };
        root.addEventListener("pointerdown", function (e) {
            var card = e.target.closest(".mg-card");
            if (!card)
                return;
            start = {x: e.clientX, y: e.clientY};
            cancel();
            timer = setTimeout(function () {
                timer = null;
                that.suppressClick = true;
                that.showCardOrChoice(card);
            }, LONG_PRESS_MS);
        });
        root.addEventListener("pointermove", function (e) {
            if (timer && start && Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 10)
                cancel();
        });
        root.addEventListener("pointerup", cancel);
        root.addEventListener("pointercancel", cancel);
        // No browser menu on a long-pressed card image
        root.addEventListener("contextmenu", function (e) {
            if (e.target.closest(".mg-card"))
                e.preventDefault();
        });
    };

    Renderer.prototype.showCardOrChoice = function (cardEl) {
        var id = cardEl.getAttribute("data-card-id");
        if (this.state.cards[id] && !cardEl.hasAttribute("data-choice"))
            this.showCard(id);
        else if (cardEl.getAttribute("data-bp"))
            this.showBlueprint(cardEl.getAttribute("data-bp"));
    };

    Renderer.prototype.handleTap = function (e) {
        if (this.suppressClick) {
            // The click that ends a long press
            this.suppressClick = false;
            e.preventDefault();
            return;
        }
        var target = e.target.closest("[data-card-id], [data-blueprint], [data-player], [data-action]");
        if (!target)
            return;
        if (target.hasAttribute("data-card-id")) {
            var id = target.getAttribute("data-card-id");
            if (this.decision && !this.decision.sent && this.decision.isSelectable(id))
                this.tapForDecision(id);
            else
                this.showCardOrChoice(target);
        } else if (target.hasAttribute("data-blueprint")) {
            this.showBlueprint(target.getAttribute("data-blueprint"));
        } else if (target.hasAttribute("data-player")) {
            this.showPlayer(target.getAttribute("data-player"));
        } else {
            var name = target.getAttribute("data-action");
            if (name.indexOf("decision:") == 0)
                this.pressForDecision(name.substring(9));
            else if (name.indexOf("decision-choose:") == 0)
                this.chooseForDecision(name.substring(16));
            else if (this.actions[name])
                this.actions[name].call(this, target);
        }
        e.preventDefault();
    };

    // ---- Answering decisions ----

    Renderer.prototype.tapForDecision = function (id) {
        var result = this.decision.tap(id);
        if (result && result.menu) {
            // The card has several actions: let the player pick one
            this.sheet.open("Choose an action", function (body) {
                var list = h("div", {class: "mg-menu"});
                for (var i = 0; i < result.menu.length; i++)
                    list.appendChild(h("button", {type: "button", class: "mg-button", "data-action": "decision-choose:" + result.menu[i].id, html: linkCardHints(result.menu[i].text || "")}));
                body.appendChild(list);
            }, false);
            return;
        }
        this.render();
    };

    Renderer.prototype.chooseForDecision = function (actionId) {
        if (!this.decision)
            return;
        this.decision.choose(actionId);
        this.sheet.close();
        this.render();
    };

    Renderer.prototype.pressForDecision = function (name) {
        if (!this.decision || this.decision.sent)
            return;
        this.decision.press(name);
        if (this.decision && this.decision.sent)
            this.sheet.close();
        this.render();
    };

    Renderer.prototype.render = function () {
        var scroll = this.saveScroll();
        this.renderTop();
        this.renderSites();
        this.renderZones();
        this.renderHandDock();
        this.renderSide();
        this.renderBottom();
        this.restoreScroll(scroll);
        if (this.scrollSitesTo) {
            var slot = this.sitesEl.querySelectorAll(".mg-site")[this.scrollSitesTo - 1];
            var strip = this.sitesEl.firstChild;
            if (slot && strip) {
                var overflow = slot.getBoundingClientRect().right - strip.getBoundingClientRect().right;
                if (overflow > 0)
                    strip.scrollLeft += overflow + 8;
            }
            this.scrollSitesTo = null;
        }
        this.showEffect();
        this.sheet.refresh();
        this.revealSelectableCards();
    };

    // When a new decision asks for cards on the table, make sure the first one is on screen
    Renderer.prototype.revealSelectableCards = function () {
        if (!this.decision || this.decision == this.revealedFor)
            return;
        this.revealedFor = this.decision;
        var table = document.getElementById("mg-table");
        var cards = table.querySelectorAll(".mg-card.mg-selectable");
        if (cards.length == 0)
            return;
        var view = table.getBoundingClientRect();
        for (var i = 0; i < cards.length; i++) {
            var rect = cards[i].getBoundingClientRect();
            if (rect.bottom > view.top && rect.top < view.bottom)
                return;
        }
        cards[0].scrollIntoView({block: "nearest", inline: "nearest"});
    };

    Renderer.prototype.saveScroll = function () {
        var positions = {};
        var rows = document.querySelectorAll("[data-row]");
        for (var i = 0; i < rows.length; i++)
            positions[rows[i].getAttribute("data-row")] = rows[i].scrollLeft;
        var log = this.sideEl.querySelector(".mg-log");
        positions["#log"] = log ? log.scrollHeight - log.scrollTop - log.clientHeight : 0;
        return positions;
    };

    Renderer.prototype.restoreScroll = function (positions) {
        var rows = document.querySelectorAll("[data-row]");
        for (var i = 0; i < rows.length; i++) {
            var saved = positions[rows[i].getAttribute("data-row")];
            if (saved)
                rows[i].scrollLeft = saved;
        }
        // The log follows new messages unless it was scrolled up
        var log = this.sideEl.querySelector(".mg-log");
        if (log && positions["#log"] < 40)
            log.scrollTop = log.scrollHeight;
    };

    // ---- Status bar ----

    Renderer.prototype.renderTop = function () {
        var s = this.state;
        clear(this.top);

        var status = h("div", {class: "mg-status"}, [
            h("span", {class: "mg-phase", text: formatPhase(s.phase) || "Starting"}),
            h("span", {class: "mg-twilight", title: "Twilight pool"}, [h("i", {class: "mg-twilight-icon"}), "" + s.twilight]),
            s.initiative ? h("span", {class: "mg-pill", text: "Init: " + (s.initiative == "FREE_PEOPLE" ? "FP" : "Shadow")}) : null,
            s.moveCount != null ? h("span", {class: "mg-pill", title: "Moves", text: "Move " + s.moveCount + "/" + s.moveLimit}) : null,
            s.fellowshipArchery != null ? h("span", {class: "mg-pill mg-fp", title: "Fellowship archery", text: "🏹 FP " + s.fellowshipArchery}) : null,
            s.shadowArchery != null ? h("span", {class: "mg-pill mg-shadow", title: "Shadow archery", text: "🏹 Sh " + s.shadowArchery}) : null,
            s.ruleOf4 != null ? h("span", {class: "mg-pill" + (s.ruleOf4 >= 4 ? " mg-warn" : ""), title: "Rule of 4", text: "R4 " + s.ruleOf4 + "/4"}) : null,
            h("button", {class: "mg-icon-button", type: "button", "data-action": "menu", "aria-label": "Menu", text: "☰"})
        ]);

        var players = h("div", {class: "mg-players"});
        var order = s.opponentIds().concat(s.bottomPlayerId != null ? [s.bottomPlayerId] : []);
        for (var i = 0; i < order.length; i++)
            players.appendChild(this.playerChip(order[i]));

        append(this.top, [status, players]);
    };

    Renderer.prototype.playerChip = function (playerId) {
        var s = this.state;
        var p = s.players[playerId] || {};
        var index = s.playerIds.indexOf(playerId);
        var you = playerId == s.bottomPlayerId && !s.spectator;
        return h("button", {
            type: "button",
            class: "mg-player" + (playerId == s.currentPlayerId ? " mg-current" : "") + (you ? " mg-you" : ""),
            "data-player": playerId
        }, [
            h("span", {class: "mg-player-no mg-p" + (index + 1), text: "" + (index + 1)}),
            h("span", {class: "mg-player-name", text: playerId}),
            s.clocks[playerId] != null ? h("span", {class: "mg-clock", text: formatTime(s.clocks[playerId])}) : null,
            h("span", {class: "mg-counts"}, [
                counter("Hand", "✋", p.hand),
                counter("Draw deck", "🂠", p.deck),
                p.threats != null ? counter("Threats", "⚠", p.threats + (p.threatTotal != null ? "/" + p.threatTotal : "")) : null
            ])
        ]);
    };

    function counter(title, icon, value) {
        if (value == null)
            return null;
        return h("span", {class: "mg-count", title: title}, [h("span", {class: "mg-count-icon", text: icon}), "" + value]);
    }

    // ---- Adventure path ----

    Renderer.prototype.renderSites = function () {
        var s = this.state;
        clear(this.sitesEl);
        var sites = s.sites();
        var bySite = {};
        var last = 9;
        for (var i = 0; i < sites.length; i++) {
            bySite[sites[i].siteNumber] = sites[i];
            last = Math.max(last, sites[i].siteNumber);
        }
        var strip = h("div", {class: "mg-site-strip", "data-row": "sites"});
        for (var n = 1; n <= last; n++) {
            var markers = h("div", {class: "mg-site-markers"});
            for (var p = 0; p < s.playerIds.length; p++) {
                if (s.positions[s.playerIds[p]] == n)
                    markers.appendChild(h("span", {
                        class: "mg-player-no mg-p" + (p + 1) + (s.playerIds[p] == s.currentPlayerId ? " mg-current" : ""),
                        title: s.playerIds[p], text: "" + (p + 1)
                    }));
            }
            var site = bySite[n];
            var slot = h("div", {class: "mg-site" + (site ? "" : " mg-site-empty")}, [
                site ? this.cardElement(site, "path") : h("span", {class: "mg-site-number", text: "" + n}),
                markers
            ]);
            strip.appendChild(slot);
        }
        this.sitesEl.appendChild(strip);

        // When a player moves, bring the sites the players stand on into view
        var furthest = 0;
        for (var id in s.positions)
            furthest = Math.max(furthest, s.positions[id]);
        if (furthest != this.lastFurthestSite) {
            this.lastFurthestSite = furthest;
            this.scrollSitesTo = furthest;
        }
    };

    // ---- The table ----

    Renderer.prototype.renderZones = function () {
        var s = this.state;
        clear(this.zonesEl);
        if (!s.initialized) {
            // Before the game starts the server sends the pre-game summary (and the burden bid) first
            if (s.pregame)
                append(this.zonesEl, h("div", {class: "mg-pregame-panel"}, [
                    h("h3", {class: "mg-zone-label", text: "Game info"}),
                    h("div", {class: "mg-pregame", html: s.pregame.summary}),
                    s.pregame.notes ? h("div", {class: "mg-pregame mg-note", html: s.pregame.notes}) : null
                ]));
            else
                this.zonesEl.appendChild(h("div", {class: "mg-empty-table", text: this.status ? this.status.text : "Loading the game…"}));
            return;
        }

        var opponents = s.opponentIds();
        var bottomName = s.spectator ? s.bottomPlayerId : "Your";

        // Two halves: stacked on a portrait screen, side by side in landscape (see index.css)
        var them = h("div", {class: "mg-half mg-half-them"});
        var us = h("div", {class: "mg-half mg-half-us"});
        append(this.zonesEl, [them, us]);

        for (var i = 0; i < opponents.length; i++) {
            this.zoneRow(them, "opp-support-" + i, opponents[i] + " · Support", s.zoneCards("SUPPORT", false).filter(ownedBy(opponents[i])), "mg-opponent", true);
            this.zoneRow(them, "opp-chars-" + i, opponents[i] + " · Characters", s.zoneCards("FREE_CHARACTERS", false).filter(ownedBy(opponents[i])), "mg-opponent");
        }
        this.zoneRow(them, "minions", "Minions", s.unassignedMinions(), "mg-shadow", true);
        for (var j = 0; j < s.playerIds.length; j++) {
            var playerId = s.playerIds[j];
            if (playerId == s.bottomPlayerId && !s.spectator)
                continue;
            this.zoneRow(them, "revealed-" + j, playerId + " · Revealed hand", s.hand(playerId), "mg-revealed", true);
        }

        this.renderSkirmish(us);
        this.renderAssignments(us);
        this.zoneRow(us, "my-chars", (s.spectator ? bottomName + " · " : "Your ") + "characters", s.zoneCards("FREE_CHARACTERS", true), "mg-mine");
        this.zoneRow(us, "my-support", (s.spectator ? bottomName + " · " : "Your ") + "support", s.zoneCards("SUPPORT", true), "mg-mine", true);
    };

    function ownedBy(playerId) {
        return function (card) {
            return card.owner == playerId;
        };
    }

    Renderer.prototype.zoneRow = function (parent, key, label, cards, className, hideWhenEmpty) {
        if (cards.length == 0 && hideWhenEmpty)
            return;
        var row = h("div", {class: "mg-row", "data-row": key});
        if (cards.length == 0)
            row.appendChild(h("span", {class: "mg-row-empty", text: "None"}));
        for (var i = 0; i < cards.length; i++)
            row.appendChild(this.cardSlot(cards[i]));
        parent.appendChild(h("section", {class: "mg-zone " + (className || "")}, [
            h("h3", {class: "mg-zone-label"}, [label, cards.length > 0 ? h("span", {class: "mg-zone-count", text: "" + cards.length}) : null]),
            row
        ]));
    };

    Renderer.prototype.renderSkirmish = function (parent) {
        var s = this.state;
        if (s.skirmish == null)
            return;
        var cards = s.skirmishCards();
        var k = s.skirmish;
        var side = function (that, cardsOfSide, strength, bonus, extraClass) {
            var row = h("div", {class: "mg-row mg-pair-side " + extraClass});
            for (var i = 0; i < cardsOfSide.length; i++)
                row.appendChild(that.cardSlot(cardsOfSide[i]));
            return h("div", {class: "mg-skirmish-side"}, [
                h("div", {class: "mg-strength" + (extraClass == "mg-fp" && k.fpOverwhelmed ? " mg-overwhelmed" : ""), title: "Strength"}, [
                    strength != null ? "" + strength : "–",
                    bonus ? h("small", {title: "Damage bonus", text: "+" + bonus}) : null
                ]),
                row
            ]);
        };
        parent.appendChild(h("section", {class: "mg-zone mg-skirmish"}, [
            h("h3", {class: "mg-zone-label"}, ["Skirmish", k.fpOverwhelmed ? h("span", {class: "mg-warn-text", text: " · Overwhelmed"}) : null]),
            h("div", {class: "mg-skirmish-body", "data-row": "skirmish"}, [
                side(this, cards.fellowship, k.fpStrength, k.fpDamageBonus, "mg-fp"),
                h("div", {class: "mg-vs", text: "vs"}),
                side(this, cards.shadow, k.shadowStrength, k.shadowDamageBonus, "mg-shadow")
            ])
        ]));
    };

    Renderer.prototype.renderAssignments = function (parent) {
        var groups = this.state.assignments();
        if (groups.length == 0)
            return;
        var list = h("div", {class: "mg-assignments", "data-row": "assignments"});
        for (var i = 0; i < groups.length; i++) {
            var g = groups[i];
            var character = g.character ? this.cardSlot(g.character, g.ghost ? "mg-ghost" : "") : h("span", {class: "mg-row-empty", text: "?"});
            var minions = h("div", {class: "mg-pair-side"});
            for (var m = 0; m < g.minions.length; m++)
                minions.appendChild(this.cardSlot(g.minions[m]));
            list.appendChild(h("div", {class: "mg-pair" + (g.ghost ? " mg-pair-waiting" : "")}, [
                h("div", {class: "mg-pair-side"}, character),
                h("div", {class: "mg-vs", text: g.ghost ? "next" : "vs"}),
                minions
            ]));
        }
        parent.appendChild(h("section", {class: "mg-zone mg-assigned"}, [
            h("h3", {class: "mg-zone-label", text: "Assignments"}),
            list
        ]));
    };

    // ---- Hand ----

    Renderer.prototype.ownHand = function () {
        var s = this.state;
        if (s.spectator || s.bottomPlayerId == null)
            return null;
        return s.hand(s.bottomPlayerId);
    };

    // Tablets show the hand under the table; phones open it from the bottom bar (see index.css)
    Renderer.prototype.renderHandDock = function () {
        clear(this.handDock);
        var hand = this.ownHand();
        if (hand == null)
            return;
        var row = h("div", {class: "mg-row mg-hand-row", "data-row": "hand"});
        if (hand.length == 0)
            row.appendChild(h("span", {class: "mg-row-empty", text: "No cards in hand"}));
        for (var i = 0; i < hand.length; i++)
            row.appendChild(this.cardSlot(hand[i]));
        append(this.handDock, [h("h3", {class: "mg-zone-label"}, ["Your hand", h("span", {class: "mg-zone-count", text: "" + hand.length})]), row]);
    };

    // ---- Side panel (tablets in landscape): the game log ----

    Renderer.prototype.renderSide = function () {
        clear(this.sideEl);
        append(this.sideEl, [h("h3", {class: "mg-zone-label", text: "Game log"}), this.logElement()]);
    };

    Renderer.prototype.logElement = function () {
        var log = h("div", {class: "mg-log"});
        var messages = this.state.messages;
        for (var i = 0; i < messages.length; i++)
            log.appendChild(h("div", {class: "mg-msg mg-msg-" + messages[i].kind, html: linkCardHints(messages[i].text)}));
        return log;
    };

    // Card names in server messages are <div class='cardHint' value='1_2'>: make them tappable
    function linkCardHints(html) {
        return html.replace(/<div class='cardHint' value='([^']*)'>/g, "<span class='mg-hint' data-blueprint='$1'>")
            .replace(/<div class="cardHint" value="([^"]*)">/g, "<span class='mg-hint' data-blueprint='$1'>")
            .replace(/<\/div>/g, "</span>");
    }

    // ---- Bottom bar ----

    Renderer.prototype.renderBottom = function () {
        var s = this.state;
        clear(this.bottom);

        var line;
        if (this.status && this.status.kind == "error") {
            line = h("div", {class: "mg-decision mg-error", text: this.status.text});
        } else if (s.ended) {
            line = h("div", {class: "mg-decision", text: "Game over"});
        } else if (s.decision && this.options.mode == "replay") {
            line = h("div", {class: "mg-decision"}, [h("b", {text: s.decision.participantId + ": "}), h("span", {html: linkCardHints(s.decision.text || "")})]);
        } else if (s.decision && !this.decision) {
            // A decision this screen can't answer (an unknown type): the standard view can
            line = h("div", {class: "mg-decision mg-mine"}, [
                h("div", {html: linkCardHints(s.decision.text || "")}),
                h("div", {class: "mg-note"}, [h("a", {href: this.options.standardViewUrl, text: "Answer in the standard view"})])
            ]);
        } else {
            var who = s.currentPlayerId ? s.currentPlayerId + "'s turn" : "";
            line = h("div", {class: "mg-decision mg-quiet", text: [who, formatPhase(s.phase), this.status ? this.status.text : null].filter(Boolean).join(" · ")});
        }

        var buttons = h("div", {class: "mg-buttons"});
        var hand = this.ownHand();
        if (hand != null)
            buttons.appendChild(h("button", {type: "button", class: "mg-button mg-hand-button", "data-action": "hand"}, ["Hand ", h("b", {text: "" + hand.length})]));
        buttons.appendChild(h("button", {type: "button", class: "mg-button mg-log-button", "data-action": "log", text: "Log"}));
        if (this.replay)
            buttons.appendChild(this.replayControls());

        var deciding = this.decision != null && !s.ended && !(this.status && this.status.kind == "error");
        this.bottom.classList.toggle("mg-deciding", deciding);
        if (deciding)
            this.decisionPanel(buttons);
        else
            append(this.bottom, [line, buttons]);
    };

    // The decision being answered: question, cards to choose from, and its buttons next to Hand and Log
    Renderer.prototype.decisionPanel = function (buttons) {
        var d = this.decision;
        var panel = h("div", {class: "mg-decision mg-mine"}, [
            h("div", {class: "mg-decision-text", html: linkCardHints(d.text)}),
            d.note ? h("div", {class: "mg-note", html: linkCardHints(d.note)}) : null
        ]);

        var strips = [];
        if (d.choiceCards.length > 0) {
            var choices = h("div", {class: "mg-row mg-strip", "data-row": "choices"});
            for (var i = 0; i < d.choiceCards.length; i++)
                choices.appendChild(this.choiceElement(d.choiceCards[i]));
            strips.push(choices);
        }
        var hand = this.ownHand();
        if (d.usesHand && hand && hand.length > 0) {
            var handRow = h("div", {class: "mg-row mg-strip mg-inline-hand", "data-row": "inline-hand"});
            for (var j = 0; j < hand.length; j++)
                handRow.appendChild(this.cardSlot(hand[j]));
            strips.push(h("div", {class: "mg-inline-hand-box"}, [h("h3", {class: "mg-zone-label", text: "Your hand"}), handRow]));
        }

        var controls = h("div", {class: "mg-controls"});
        if (d.sent) {
            controls.appendChild(h("span", {class: "mg-note", text: "Sending…"}));
        } else {
            if (d.stepper) {
                controls.appendChild(h("div", {class: "mg-stepper"}, [
                    h("button", {type: "button", class: "mg-button", "data-action": "decision:dec", "aria-label": "Less", disabled: d.stepper.value <= d.stepper.min, text: "−"}),
                    h("span", {class: "mg-stepper-value", text: "" + d.stepper.value}),
                    h("button", {type: "button", class: "mg-button", "data-action": "decision:inc", "aria-label": "More", disabled: d.stepper.value >= d.stepper.max, text: "+"})
                ]));
            }
            var list = d.controls();
            for (var k = 0; k < list.length; k++) {
                var c = list[k];
                var attrs = {type: "button", class: "mg-button" + (c.primary ? " mg-primary" : ""), "data-action": "decision:" + c.name, disabled: !!c.disabled};
                if (c.html)
                    attrs.html = linkCardHints(c.label).replace(/data-blueprint=/g, "data-hint=");
                else
                    attrs.text = c.label;
                controls.appendChild(h("button", attrs));
            }
        }

        append(this.bottom, [panel].concat(strips).concat([controls, buttons]));
    };

    // A card offered by the decision that isn't on the table (from the deck, discard pile, or an action shown as a card)
    Renderer.prototype.choiceElement = function (choice) {
        var card = this.state.cards[choice.id];
        var blueprintId = choice.blueprintId || (card && card.blueprintId);
        var el = this.cardElement({
            cardId: choice.id, blueprintId: blueprintId, zone: "SPECIAL", tokens: {}, stats: null,
            testingText: choice.label
        }, "row");
        el.setAttribute("data-choice", "");
        el.setAttribute("data-bp", blueprintId || "");
        if (!choice.selectable)
            el.classList.add("mg-not-selectable");
        var caption = choice.label && choice.label != blueprintId ? h("div", {class: "mg-choice-label", html: linkCardHints(choice.label).replace(/data-blueprint=/g, "data-hint=")}) : null;
        return h("div", {class: "mg-slot"}, [el, caption]);
    };

    Renderer.prototype.replayControls = function () {
        var r = this.replay;
        return h("div", {class: "mg-replay"}, [
            h("button", {type: "button", class: "mg-button", "data-action": "replay-toggle", "aria-label": r.playing ? "Pause" : "Play", text: r.playing ? "⏸" : "▶"}),
            h("button", {type: "button", class: "mg-button", "data-action": "replay-step", "aria-label": "Next step", text: "⏭"}),
            h("button", {type: "button", class: "mg-button", "data-action": "replay-speed", "aria-label": "Speed", text: r.speed + "×"}),
            h("span", {class: "mg-progress", text: r.position + "/" + r.total})
        ]);
    };

    // ---- Short-lived effects: an event card being played, a card being used ----

    Renderer.prototype.showEffect = function () {
        var s = this.state;
        var effect = s.effect;
        if (effect == null || effect.seq == this.lastEffectSeq)
            return;
        this.lastEffectSeq = effect.seq;
        // Like the desktop client: your own actions aren't replayed back to you
        if (this.options.mode != "replay" && !s.spectator && effect.participantId == s.bottomPlayerId)
            return;

        for (var i = 0; i < effect.cardIds.length; i++) {
            var els = document.querySelectorAll(".mg-card[data-card-id='" + effect.cardIds[i] + "']");
            for (var j = 0; j < els.length; j++)
                els[j].classList.add("mg-pulse");
        }
        if (effect.blueprintId) {
            var visual = cardVisual(effect.blueprintId, "ANIMATION", s.metaSiteVisuals);
            clear(this.effectEl);
            append(this.effectEl, [
                h("div", {class: "mg-effect-card" + (visual.horizontal ? " mg-horizontal" : "")}, cardImage(visual.imageUrl, effect.blueprintId)),
                h("div", {class: "mg-effect-text", text: (effect.participantId || "") + (effect.kind == "event" ? " plays" : " uses")})
            ]);
            var el = this.effectEl;
            el.classList.remove("mg-show");
            void el.offsetWidth;
            el.classList.add("mg-show");
            clearTimeout(this.effectTimer);
            this.effectTimer = setTimeout(function () {
                el.classList.remove("mg-show");
            }, 1600 * (this.options.effectScale || 1));
        }
    };

    // ---- Cards ----

    // A card with whatever is attached to it or stacked on it shown underneath, so nothing is hidden
    Renderer.prototype.cardSlot = function (card, extraClass) {
        var attached = this.state.attachedTo(card.cardId);
        var stacked = this.state.stackedOn(card.cardId);
        var slot = h("div", {class: "mg-slot " + (extraClass || "")}, this.cardElement(card, "row"));
        if (attached.length + stacked.length > 0) {
            var under = h("div", {class: "mg-under"});
            for (var i = 0; i < attached.length; i++)
                under.appendChild(this.cardElement(attached[i], "mini"));
            for (var j = 0; j < stacked.length; j++)
                under.appendChild(this.cardElement(stacked[j], "mini mg-stacked"));
            slot.appendChild(under);
        }
        return slot;
    };

    Renderer.prototype.cardElement = function (card, size) {
        var s = this.state;
        var visual = cardVisual(card.blueprintId, card.zone, s.metaSiteVisuals);
        var classes = ["mg-card", "mg-" + size.split(" ")[0]];
        if (size.indexOf(" ") > 0)
            classes.push(size.substring(size.indexOf(" ") + 1));
        if (visual.horizontal)
            classes.push("mg-horizontal");
        if (card.inactive)
            classes.push("mg-inactive");
        if (card.flipped)
            classes.push("mg-flipped");
        if (card.skirmish)
            classes.push("mg-in-skirmish");
        if (this.decision && !this.decision.sent) {
            if (this.decision.isSelected(card.cardId))
                classes.push("mg-selected");
            else if (this.decision.isSelectable(card.cardId))
                classes.push("mg-selectable");
        }

        var el = h("div", {class: classes.join(" "), "data-card-id": card.cardId, "data-bp": card.blueprintId, "data-label": card.testingText || card.blueprintId, role: "button", tabindex: "0"},
            cardImage(card.flipped ? visual.backUrl : visual.imageUrl, card.blueprintId));
        if (visual.overlayUrl && !card.flipped)
            el.appendChild(h("div", {class: "mg-meta-overlay"}, cardImage(visual.overlayUrl, "")));

        if (size != "mini") {
            var count = s.attachedTo(card.cardId).length + s.stackedOn(card.cardId).length;
            if (count > 0)
                el.appendChild(h("span", {class: "mg-attach-badge", title: count + " attached or stacked", text: "+" + count}));
            this.addStats(el, card);
        }
        this.addTokens(el, card);
        return el;
    };

    Renderer.prototype.addStats = function (el, card) {
        var stats = card.stats;
        if (stats == null || card.flipped)
            return;
        var box = h("div", {class: "mg-stats"}, [
            stats.strength != null ? h("span", {class: "mg-stat mg-str", title: "Strength", text: stats.strength}) : null,
            stats.vitality != null ? h("span", {class: "mg-stat mg-vit", title: "Vitality", text: stats.vitality}) : null,
            stats.resistance != null ? h("span", {class: "mg-stat mg-res", title: "Resistance" + (stats.resistanceKind ? " (" + RESISTANCE_NAMES[stats.resistanceKind] + ")" : ""), text: stats.resistance}) : null,
            stats.siteNumber != null ? h("span", {class: "mg-stat mg-sitenum", title: "Site number", text: stats.siteNumber}) : null
        ]);
        el.appendChild(box);
    };

    Renderer.prototype.addTokens = function (el, card) {
        var tokens = card.tokens;
        var box = null;
        for (var token in tokens) {
            if (!tokens.hasOwnProperty(token) || tokens[token] <= 0)
                continue;
            if (box == null)
                box = h("div", {class: "mg-tokens"});
            if (token == "count") {
                box.appendChild(h("span", {class: "mg-token mg-token-count", text: "" + tokens[token]}));
                continue;
            }
            var img = h("img", {src: "images/tokens/" + token.toLowerCase() + ".png", alt: token.toLowerCase()});
            box.appendChild(h("span", {class: "mg-token", title: token.toLowerCase() + " × " + tokens[token]}, [img, h("b", {text: "" + tokens[token]})]));
        }
        if (box)
            el.appendChild(box);
    };

    // ---- Sheets: card details, player piles, hand, log, menu ----

    Renderer.prototype.showCard = function (cardId) {
        var s = this.state;
        var that = this;
        var card = s.cards[cardId];
        if (!card)
            return;
        this.sheet.open("Card", function (body) {
            card = s.cards[cardId];
            if (!card) {
                body.appendChild(h("p", {text: "This card has left play."}));
                return;
            }
            var visual = cardVisual(card.blueprintId, card.zone, s.metaSiteVisuals);
            var big = h("div", {class: "mg-big-card" + (visual.horizontal ? " mg-horizontal" : "")},
                cardImage(card.flipped ? visual.backUrl : visual.imageUrl, card.blueprintId));
            if (visual.overlayUrl && !card.flipped)
                big.appendChild(h("div", {class: "mg-meta-overlay"}, cardImage(visual.overlayUrl, "")));

            var facts = [];
            facts.push((ZONE_NAMES[card.zone] || card.zone) + (card.owner ? " · " + card.owner : ""));
            if (card.flipped)
                facts.push("Hindered (face down)");
            if (card.inactive)
                facts.push("Inactive");
            if (card.attachedTo && s.cards[card.attachedTo])
                facts.push("Attached to another card");
            var st = card.stats;
            var statLine = st ? [
                st.strength != null ? "Strength " + st.strength : null,
                st.vitality != null ? "Vitality " + st.vitality : null,
                st.resistance != null ? "Resistance " + st.resistance : null,
                st.siteNumber != null ? "Site " + st.siteNumber : null
            ].filter(Boolean).join(" · ") : "";
            var tokenLine = Object.keys(card.tokens).filter(function (t) {
                return card.tokens[t] > 0;
            }).map(function (t) {
                return t.toLowerCase().replace(/_/g, " ") + " × " + card.tokens[t];
            }).join(", ");

            append(body, [
                big,
                h("div", {class: "mg-card-facts"}, [
                    h("div", {text: facts.join(" · ")}),
                    statLine ? h("div", {class: "mg-card-stats", text: statLine}) : null,
                    tokenLine ? h("div", {text: "Tokens: " + tokenLine}) : null
                ])
            ]);

            var host = card.attachedTo ? s.cards[card.attachedTo] : (card.stackedOn ? s.cards[card.stackedOn] : null);
            if (host)
                that.miniList(body, card.attachedTo ? "Attached to" : "Stacked on", [host]);
            that.miniList(body, "Attached", s.attachedTo(card.cardId));
            that.miniList(body, "Stacked", s.stackedOn(card.cardId));

            if (that.options.loadModifiers) {
                var mods = h("div", {class: "mg-modifiers", text: "Loading modifiers…"});
                body.appendChild(h("h4", {text: "Modifiers"}));
                body.appendChild(mods);
                that.options.loadModifiers(card.cardId, function (html) {
                    mods.innerHTML = linkCardHints(html || "") || "None";
                });
            }
        }, false);
    };

    Renderer.prototype.miniList = function (body, title, cards) {
        if (cards.length == 0)
            return;
        var row = h("div", {class: "mg-row mg-sheet-row"});
        for (var i = 0; i < cards.length; i++)
            row.appendChild(this.cardElement(cards[i], "row"));
        append(body, [h("h4", {text: title + " (" + cards.length + ")"}), row]);
    };

    Renderer.prototype.showBlueprint = function (blueprintId) {
        var visual = cardVisual(blueprintId, "SPECIAL", this.state.metaSiteVisuals);
        this.sheet.open("Card", function (body) {
            body.appendChild(h("div", {class: "mg-big-card" + (visual.horizontal ? " mg-horizontal" : "")}, cardImage(visual.imageUrl, blueprintId)));
        }, false);
    };

    Renderer.prototype.showPlayer = function (playerId) {
        var s = this.state;
        var that = this;
        this.sheet.open(playerId, function (body) {
            var p = s.players[playerId] || {};
            var rows = [
                ["Time bank", s.clocks[playerId] != null ? formatTime(s.clocks[playerId]) : null],
                ["Site", s.positions[playerId]],
                ["Hand", p.hand], ["Draw deck", p.deck],
                ["Threats", p.threats != null ? p.threats + (p.threatTotal != null ? " / " + p.threatTotal : "") : null],
                ["Discard pile", p.discard], ["Dead pile", p.dead], ["Adventure deck", p.adventureDeck],
                ["Removed from game", p.removed]
            ];
            var table = h("dl", {class: "mg-facts"});
            for (var i = 0; i < rows.length; i++) {
                if (rows[i][1] == null)
                    continue;
                append(table, [h("dt", {text: rows[i][0]}), h("dd", {text: "" + rows[i][1]})]);
            }
            body.appendChild(table);
            // Pile contents the server has shown us (the discard pile only when it is public, or our own)
            var piles = [["DISCARD", "Discard pile"], ["DEAD", "Dead pile"], ["REMOVED", "Removed from game"], ["ADVENTURE_DECK", "Adventure deck"]];
            for (var j = 0; j < piles.length; j++)
                that.miniList(body, piles[j][1], s.pile(playerId, piles[j][0]));
            if (playerId != s.bottomPlayerId || s.spectator)
                that.miniList(body, "Revealed hand", s.hand(playerId));
        }, true);
    };

    Renderer.prototype.actions = {
        hand: function () {
            var that = this;
            this.sheet.open("Your hand", function (body) {
                var hand = that.ownHand() || [];
                var grid = h("div", {class: "mg-grid"});
                for (var i = 0; i < hand.length; i++)
                    grid.appendChild(that.cardSlot(hand[i]));
                if (hand.length == 0)
                    grid.appendChild(h("p", {text: "No cards in hand."}));
                body.appendChild(grid);
            }, true);
        },
        log: function () {
            var that = this;
            var opening = true;
            this.sheet.open("Game log", function (body) {
                body.appendChild(that.logElement());
                if (opening)
                    setTimeout(function () {
                        body.scrollTop = body.scrollHeight;
                    }, 0);
                opening = false;
            }, true);
        },
        menu: function () {
            var that = this;
            this.sheet.open("Menu", function (body) {
                var items = h("div", {class: "mg-menu"});
                if (that.state.pregame)
                    items.appendChild(h("button", {type: "button", class: "mg-button", "data-action": "pregame", text: "Game info"}));
                items.appendChild(h("a", {class: "mg-button", href: that.options.standardViewUrl, text: "Switch to standard view"}));
                items.appendChild(h("a", {class: "mg-button", href: "hall.html", text: "Back to the game hall"}));
                body.appendChild(items);
            }, false);
        },
        pregame: function () {
            this.showPregame();
        },
        "replay-toggle": function () {
            this.options.onReplay && this.options.onReplay("toggle");
        },
        "replay-step": function () {
            this.options.onReplay && this.options.onReplay("step");
        },
        "replay-speed": function () {
            this.options.onReplay && this.options.onReplay("speed");
        }
    };

    Renderer.prototype.showPregame = function () {
        var pregame = this.state.pregame;
        if (!pregame)
            return;
        this.sheet.open("Game info", function (body) {
            body.appendChild(h("div", {class: "mg-pregame", html: pregame.summary}));
            if (pregame.notes)
                body.appendChild(h("div", {class: "mg-pregame mg-note", html: pregame.notes}));
        }, false);
    };

    // ---- The bottom sheet ----

    function Sheet(root) {
        this.root = root;
        this.title = root.querySelector(".mg-sheet-title");
        this.body = root.querySelector(".mg-sheet-body");
        this.build = null;
        this.live = false;
        var that = this;
        root.querySelector(".mg-sheet-close").addEventListener("click", function () {
            that.close();
        });
        root.querySelector(".mg-sheet-backdrop").addEventListener("click", function () {
            that.close();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key == "Escape")
                that.close();
        });
    }

    // live: rebuild the sheet when the game changes (hand, log, player piles)
    Sheet.prototype.open = function (title, build, live) {
        this.title.textContent = title;
        this.build = build;
        this.live = live;
        clear(this.body);
        build(this.body);
        this.root.hidden = false;
        this.body.scrollTop = 0;
    };

    Sheet.prototype.refresh = function () {
        if (this.root.hidden || !this.live || !this.build)
            return;
        var scroll = this.body.scrollTop;
        clear(this.body);
        this.build(this.body);
        this.body.scrollTop = scroll;
    };

    Sheet.prototype.close = function () {
        this.root.hidden = true;
        this.build = null;
        clear(this.body);
    };

    Renderer.formatTime = formatTime;
    return Renderer;
})();
