// Game state for the mobile game screen: a plain model of the table, built from the server's game events.
//
// The desktop client keeps the game state inside its card elements; the mobile screen keeps it here instead, so the
// renderer only has to draw it and the event handling can be tested without a browser (mobile-client/dev).
//
// Events are plain objects: {type, attr: {name: value}, children: [{tag, attr}]} - see MobileGameState.eventFromXml.
// Each handler mirrors the matching one in gameAnimations.js / gameUi.js; the comments name the event codes.

(function (root) {

    var PILE_ZONES = ["DISCARD", "DEAD", "REMOVED", "ADVENTURE_DECK", "DECK"];

    function GameState() {
        this.playerIds = [];
        this.me = null;                 // participant id the server sent (P), also for spectators
        this.bottomPlayerId = null;     // the player shown at the bottom: me, or the second player when spectating
        this.spectator = false;
        this.discardPublic = false;
        this.initialized = false;       // true once the participant (P) event arrived

        this.cards = {};                // cardId -> card (see putCardInPlay)
        this.nextSeq = 1;               // keeps cards in the order they arrived

        this.phase = null;
        this.twilight = 0;
        this.currentPlayerId = null;
        this.positions = {};            // playerId -> site number
        this.players = {};              // playerId -> pile counts, threats, revealed hand
        this.fellowshipArchery = null;
        this.shadowArchery = null;
        this.moveCount = null;
        this.moveLimit = null;
        this.initiative = null;
        this.ruleOf4 = null;

        this.skirmish = null;           // {fpStrength, shadowStrength, fpOverwhelmed, fpDamageBonus, shadowDamageBonus}
        this.decision = null;           // the pending decision of this player, if any
        this.messages = [];             // game log: {text, kind: "game" | "warning"}
        this.effect = null;             // the last card effect worth showing: {kind, blueprintId, cardIds, participantId, seq}
        this.effectSeq = 0;

        this.clocks = {};               // playerId -> seconds left in the time bank
        this.decisionClock = null;
        this.decisionLimit = null;

        this.pregame = null;            // the pre-game summary (PGS)
        this.metaSiteVisuals = {};      // meta-site modifier blueprint -> visual blueprint
        this.ended = false;
    }

    GameState.MAX_MESSAGES = 500;

    // ---- Reading events ----

    // Converts a <ge> element of the server's XML into the plain event object used here
    GameState.eventFromXml = function (element) {
        return {
            type: element.getAttribute("type"),
            attr: attributesOf(element),
            children: childElements(element).map(function (child) {
                return {tag: child.tagName, attr: attributesOf(child)};
            })
        };
    };

    function attributesOf(element) {
        var attr = {};
        for (var i = 0; i < element.attributes.length; i++)
            attr[element.attributes[i].name] = element.attributes[i].value;
        return attr;
    }

    function childElements(element) {
        var result = [];
        for (var i = 0; i < element.childNodes.length; i++)
            if (element.childNodes[i].nodeType == 1)
                result.push(element.childNodes[i]);
        return result;
    }

    function splitIds(value) {
        if (value == null || value === "")
            return [];
        return value.split(",");
    }

    // ---- Applying events ----

    // A response from the server (or one replay step) starts: a decision from before it no longer applies
    GameState.prototype.beginBatch = function () {
        this.decision = null;
    };

    GameState.prototype.apply = function (event) {
        var handler = HANDLERS[event.type];
        if (handler)
            handler.call(this, event.attr, event);
    };

    GameState.prototype.applyClocks = function (clocks) {
        for (var i = 0; i < clocks.length; i++) {
            var participantId = clocks[i].participantId;
            var value = clocks[i].value;
            if (participantId == "decisionLimit")
                this.decisionLimit = value;
            else if (participantId == "decisionClock")
                this.decisionClock = value;
            else if (this.playerIds.indexOf(participantId) >= 0)
                this.clocks[participantId] = value;
        }
    };

    var HANDLERS = {
        // Participant: who we are, and everyone in the game
        P: function (a) {
            this.playerIds = splitIds(a.allParticipantIds);
            this.me = a.participantId;
            this.discardPublic = a.discardPublic === "true";
            if (this.playerIds.indexOf(this.me) == -1) {
                this.spectator = true;
                this.bottomPlayerId = this.playerIds[1];
            } else {
                this.spectator = false;
                this.bottomPlayerId = this.me;
            }
            for (var i = 0; i < this.playerIds.length; i++)
                this.playerFor(this.playerIds[i]);
            this.initialized = true;
        },

        // Pre-game setup: summary, deck notes, maps and meta-sites
        PGS: function (a) {
            if (a.metaSites) {
                var entries = a.metaSites.split(",");
                for (var i = 0; i < entries.length; i++) {
                    var pairs = entries[i].substring(entries[i].indexOf(":") + 1).split(";");
                    for (var j = 0; j < pairs.length; j++) {
                        var ids = pairs[j].split("|");
                        this.metaSiteVisuals[ids[1]] = ids[0];
                    }
                }
            }
            this.pregame = {
                summary: a.summary || "",
                notes: a.notes || "",
                maps: a.maps || "",
                metaSites: a.metaSites || "",
                participantId: a.participantId,
                allPlayerIds: splitIds(a.allParticipantIds)
            };
        },

        // Put card in play
        PCIP: function (a) {
            var card = {
                cardId: a.cardId,
                blueprintId: a.blueprintId,
                testingText: a.testingText != null ? a.testingText : null,
                backSideTestingText: a.backSideTestingText != null ? a.backSideTestingText : null,
                zone: a.zone,
                owner: a.controllerId != null ? a.controllerId : a.participantId,
                siteNumber: a.zone == "ADVENTURE_PATH" && a.index != null ? parseInt(a.index) : null,
                flipped: a.hindered === "true",
                attachedTo: null,
                stackedOn: null,
                tokens: {},
                stats: null,
                skirmish: false,
                assign: null,
                inactive: false,
                seq: this.nextSeq++
            };
            this.cards[card.cardId] = card;
            this.attach(card, a.targetCardId, a.targetType);
        },

        // Move card in play: new zone, owner and host
        MCIP: function (a) {
            var card = this.cards[a.cardId];
            if (!card)
                return;
            card.attachedTo = null;
            card.stackedOn = null;
            card.zone = a.zone;
            card.owner = a.controllerId != null ? a.controllerId : a.participantId;
            this.attach(card, a.targetCardId, a.targetType);
        },

        // Flip cards in play: hindered cards are shown face down
        FCIP: function (a) {
            var ids = splitIds(a.otherCardIds);
            for (var i = 0; i < ids.length; i++)
                if (this.cards[ids[i]])
                    this.cards[ids[i]].flipped = a.hindered === "true";
        },

        // Remove card from play
        RCFP: function (a) {
            var ids = splitIds(a.otherCardIds);
            for (var i = 0; i < ids.length; i++)
                delete this.cards[ids[i]];
        },

        // Game phase change
        GPC: function (a) {
            this.phase = a.phase;
        },

        // Twilight pool
        TP: function (a) {
            this.twilight = parseInt(a.count);
        },

        // Turn change: the current player, and which cards are inactive (when the server says)
        TC: function (a) {
            this.currentPlayerId = a.participantId;
            if (a.otherCardIds) {
                var inactive = splitIds(a.otherCardIds);
                for (var id in this.cards)
                    this.cards[id].inactive = inactive.indexOf(id) >= 0;
            }
        },

        // Add assignment: minions assigned to a character. A negative character id is a skirmish that was split up:
        // the minions wait their turn against a "ghost" of the character (card id without the minus).
        AA: function (a) {
            var minions = splitIds(a.otherCardIds);
            for (var i = 0; i < minions.length; i++)
                if (this.cards[minions[i]])
                    this.cards[minions[i]].assign = a.cardId;
        },

        // Remove assignment
        RA: function (a) {
            var id;
            if (Number(a.cardId) < 0) {
                var minions = splitIds(a.otherCardIds);
                for (var i = 0; i < minions.length; i++) {
                    var minion = this.cards[minions[i]];
                    if (minion && minion.assign == a.cardId)
                        minion.assign = null;
                }
            } else {
                for (id in this.cards)
                    if (this.cards[id].assign == a.cardId)
                        this.cards[id].assign = null;
            }
        },

        // Start skirmish
        SS: function (a) {
            var ids = splitIds(a.otherCardIds);
            if (a.cardId != null)
                ids.push(a.cardId);
            for (var i = 0; i < ids.length; i++)
                if (this.cards[ids[i]])
                    this.cards[ids[i]].skirmish = true;
            this.skirmish = {fpStrength: null, shadowStrength: null, fpOverwhelmed: false,
                fpDamageBonus: 0, shadowDamageBonus: 0};
        },

        // Add to skirmish
        ATS: function (a) {
            if (this.cards[a.cardId])
                this.cards[a.cardId].skirmish = true;
        },

        // Remove from skirmish
        RFS: function (a) {
            if (this.cards[a.cardId])
                this.cards[a.cardId].skirmish = false;
        },

        // End skirmish
        ES: function () {
            this.skirmish = null;
            for (var id in this.cards)
                this.cards[id].skirmish = false;
        },

        // Add tokens
        AT: function (a) {
            this.addTokens(a.cardId, a.token, parseInt(a.count));
        },

        // Remove tokens
        RT: function (a) {
            this.addTokens(a.cardId, a.token, -parseInt(a.count));
        },

        // Player position on the adventure path
        PP: function (a) {
            this.positions[a.participantId] = parseInt(a.index);
        },

        // Game stats: character stats, archery, moves, initiative, piles, threats and skirmish strength
        GS: function (a, event) {
            if (a.charStats) {
                var entries = a.charStats.split(",");
                for (var i = 0; i < entries.length; i++) {
                    var parts = entries[i].split("=");
                    var card = this.cards[parts[0]];
                    if (card)
                        card.stats = parseCardStats(parts[1]);
                }
            }

            if (a.fellowshipArchery != null)
                this.fellowshipArchery = a.fellowshipArchery == "null" ? null : a.fellowshipArchery;
            if (a.shadowArchery != null)
                this.shadowArchery = a.shadowArchery == "null" ? null : a.shadowArchery;
            if (a.moveCount != null) {
                this.moveCount = a.moveCount;
                this.moveLimit = a.moveLimit;
            }
            if (a.initiative != null)
                this.initiative = a.initiative;
            this.ruleOf4 = (a.ruleof4 == null || a.ruleof4 == "-1") ? null : parseInt(a.ruleof4);

            var threats = {};
            var threatTotals = {};
            for (var c = 0; c < event.children.length; c++) {
                var child = event.children[c];
                if (child.tag == "playerZones") {
                    var player = this.playerFor(child.attr.name);
                    player.hand = toCount(child.attr.HAND);
                    player.deck = toCount(child.attr.DECK);
                    player.discard = toCount(child.attr.DISCARD);
                    player.dead = toCount(child.attr.DEAD);
                    player.adventureDeck = toCount(child.attr.ADVENTURE_DECK);
                    player.removed = toCount(child.attr.REMOVED);
                    player.handRevealed = child.attr.handRevealed === "true";
                } else if (child.tag == "threats") {
                    threats[child.attr.name] = child.attr.value;
                } else if (child.tag == "threatTotals") {
                    threatTotals[child.attr.name] = child.attr.value;
                }
            }
            for (var name in threats) {
                var p = this.playerFor(name);
                p.threats = toCount(threats[name]);
                p.threatTotal = threatTotals[name] == null || threatTotals[name] == "-1" ? null : toCount(threatTotals[name]);
            }

            if (this.skirmish != null) {
                if (a.fellowshipStrength != null)
                    this.skirmish.fpStrength = a.fellowshipStrength;
                if (a.shadowStrength != null)
                    this.skirmish.shadowStrength = a.shadowStrength;
                if (a.fpOverwhelmed != null)
                    this.skirmish.fpOverwhelmed = a.fpOverwhelmed == "true";
                if (a.fellowshipDamageBonus != null)
                    this.skirmish.fpDamageBonus = parseInt(a.fellowshipDamageBonus);
                if (a.shadowDamageBonus != null)
                    this.skirmish.shadowDamageBonus = parseInt(a.shadowDamageBonus);
            }
        },

        // Message
        M: function (a) {
            this.addMessage(a.message, "game");
        },

        // Warning
        W: function (a) {
            this.addMessage(a.message, "warning");
        },

        // Card affects card, event played, card activated: shown briefly, they don't change the table
        CAC: function (a) {
            this.setEffect("affects", a.blueprintId, splitIds(a.otherCardIds), a.participantId);
        },
        EP: function (a) {
            this.setEffect("event", a.blueprintId, [], a.participantId);
        },
        CA: function (a) {
            this.setEffect("activated", null, [a.cardId], a.participantId);
        },

        // Decision
        D: function (a, event) {
            var params = {};
            for (var i = 0; i < event.children.length; i++) {
                var child = event.children[i];
                if (child.tag == "parameter") {
                    if (!params[child.attr.name])
                        params[child.attr.name] = [];
                    params[child.attr.name].push(child.attr.value);
                }
            }
            this.decision = {
                id: a.id,
                type: a.decisionType,
                text: a.text,
                participantId: a.participantId,
                params: params
            };
        },

        // End of game
        EG: function () {
            this.ended = true;
            this.decision = null;
        }
    };

    function parseCardStats(value) {
        var parts = value.split("|");
        var stats = {strength: parts[0], vitality: parts[1], resistance: null, resistanceKind: null, siteNumber: null};
        if (parts.length > 2) {
            if (parts[2].indexOf("R") == 0) {
                var resistance = parts[2].substring(1);
                // A/F/G/T: the resistance belongs to Aragorn, Frodo, Gandalf or Theoden and has its own icon
                if (/^[AFGT]/.test(resistance)) {
                    stats.resistanceKind = resistance.charAt(0);
                    resistance = resistance.substring(1);
                }
                stats.resistance = resistance;
            } else {
                stats.siteNumber = parts[2];
            }
        }
        return stats;
    }

    function toCount(value) {
        if (value == null || value === "")
            return null;
        var number = parseInt(value);
        return isNaN(number) ? null : number;
    }

    // ---- Helpers used by the handlers ----

    GameState.prototype.playerFor = function (playerId) {
        if (!this.players[playerId])
            this.players[playerId] = {hand: null, deck: null, discard: null, dead: null, adventureDeck: null,
                removed: null, threats: null, threatTotal: null, handRevealed: false};
        return this.players[playerId];
    };

    GameState.prototype.attach = function (card, targetCardId, targetType) {
        if (targetCardId == null)
            return;
        // Anything that isn't stacked is attached; old replays have no target type at all
        if (targetType == "stacked")
            card.stackedOn = targetCardId;
        else
            card.attachedTo = targetCardId;
    };

    GameState.prototype.addTokens = function (cardId, token, count) {
        var card = this.cards[cardId];
        if (!card)
            return;
        card.tokens[token] = (card.tokens[token] || 0) + count;
    };

    GameState.prototype.addMessage = function (text, kind) {
        this.messages.push({text: text, kind: kind});
        if (this.messages.length > GameState.MAX_MESSAGES)
            this.messages.splice(0, this.messages.length - GameState.MAX_MESSAGES);
    };

    GameState.prototype.setEffect = function (kind, blueprintId, cardIds, participantId) {
        this.effect = {kind: kind, blueprintId: blueprintId, cardIds: cardIds, participantId: participantId,
            seq: ++this.effectSeq};
    };

    // ---- Questions the renderer asks ----

    GameState.prototype.opponentIds = function () {
        var that = this;
        return this.playerIds.filter(function (id) {
            return id != that.bottomPlayerId;
        });
    };

    GameState.prototype.sortedCards = function (predicate) {
        var result = [];
        for (var id in this.cards)
            if (predicate(this.cards[id]))
                result.push(this.cards[id]);
        result.sort(function (a, b) {
            return a.seq - b.seq;
        });
        return result;
    };

    GameState.prototype.attachedTo = function (cardId) {
        return this.sortedCards(function (card) {
            return card.attachedTo == cardId;
        });
    };

    GameState.prototype.stackedOn = function (cardId) {
        return this.sortedCards(function (card) {
            return card.stackedOn == cardId;
        });
    };

    // Characters that have minions assigned to them (character id -> minions), real or "ghost" (negative id)
    GameState.prototype.assignments = function () {
        var groups = {};
        var order = [];
        var minions = this.sortedCards(function (card) {
            return card.assign != null && card.zone == "SHADOW_CHARACTERS" && !card.skirmish;
        });
        for (var i = 0; i < minions.length; i++) {
            var characterId = minions[i].assign;
            if (!groups[characterId]) {
                groups[characterId] = [];
                order.push(characterId);
            }
            groups[characterId].push(minions[i]);
        }
        var that = this;
        return order.map(function (characterId) {
            var ghost = Number(characterId) < 0;
            return {
                characterId: characterId,
                character: that.cards[ghost ? String(-Number(characterId)) : characterId] || null,
                ghost: ghost,
                minions: groups[characterId]
            };
        });
    };

    GameState.prototype.isAssignedCharacter = function (cardId) {
        for (var id in this.cards)
            if (this.cards[id].assign == cardId && this.cards[id].zone == "SHADOW_CHARACTERS")
                return true;
        return false;
    };

    // The rows of the table, as the desktop client groups them
    GameState.prototype.zoneCards = function (zone, ownerIsBottom) {
        var that = this;
        return this.sortedCards(function (card) {
            return card.zone == zone
                && (card.owner == that.bottomPlayerId) == ownerIsBottom
                && !card.skirmish
                && !that.isAssignedCharacter(card.cardId);
        });
    };

    GameState.prototype.unassignedMinions = function () {
        return this.sortedCards(function (card) {
            return card.zone == "SHADOW_CHARACTERS" && card.assign == null && !card.skirmish;
        });
    };

    GameState.prototype.skirmishCards = function () {
        return {
            fellowship: this.sortedCards(function (card) {
                return card.skirmish && (card.zone == "FREE_CHARACTERS" || card.zone == "SUPPORT");
            }),
            shadow: this.sortedCards(function (card) {
                return card.skirmish && card.zone == "SHADOW_CHARACTERS";
            })
        };
    };

    GameState.prototype.hand = function (playerId) {
        return this.sortedCards(function (card) {
            return card.zone == "HAND" && card.owner == playerId;
        });
    };

    GameState.prototype.pile = function (playerId, zone) {
        return this.sortedCards(function (card) {
            return card.zone == zone && card.owner == playerId;
        });
    };

    GameState.prototype.sites = function () {
        var sites = this.sortedCards(function (card) {
            return card.zone == "ADVENTURE_PATH";
        });
        sites.sort(function (a, b) {
            return a.siteNumber - b.siteNumber;
        });
        return sites;
    };

    GameState.PILE_ZONES = PILE_ZONES;

    root.MobileGameState = GameState;
    if (typeof module !== "undefined" && module.exports)
        module.exports = GameState;
})(typeof window !== "undefined" ? window : this);
