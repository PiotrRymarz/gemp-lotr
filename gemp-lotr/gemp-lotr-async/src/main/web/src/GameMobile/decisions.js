// Answering the server's decisions on the mobile game screen.
//
// One object per decision type. Each knows which cards can be tapped, what is selected, which buttons to show and
// how to build the answer the server expects; render.js draws it and passes the taps and button presses back.
// No screen code here, so the answers can be tested in Node (mobile-client/dev/test-decisions.js).
// The desktop versions are the *Decision functions in js/gemp-022/gameUi.js; the answer formats are the same.
//
// Common interface:
//   text                 what is being asked (may contain card hints)
//   isSelectable(id)     whether tapping this card does something
//   isSelected(id)       whether it is currently chosen
//   tap(id)              a card was tapped; returns {menu: [{id, text}]} when the player must pick one of its actions
//   choose(actionId)     one action from such a menu was picked
//   choiceCards          cards to choose from that aren't on the table: [{id, blueprintId, label, selectable}]
//   usesHand             whether cards in the player's hand take part (phones then show the hand inline)
//   controls()           buttons: [{name, label, primary, disabled}]
//   press(name)          a button was pressed
//   stepper              INTEGER only: {value, min, max}
//   note                 an extra line to show (for example a warning before sending)
// The decision calls send(value) when the player is done. With the auto-accept setting, picking the last card needed
// (or an action) sends at once, as on the desktop.

(function (root) {

    function params(decision, name) {
        return decision.params[name] || [];
    }

    function param(decision, name) {
        var values = params(decision, name);
        return values.length > 0 ? values[0] : null;
    }

    function intParam(decision, name, fallback) {
        var value = param(decision, name);
        return value == null || isNaN(parseInt(value)) ? fallback : parseInt(value);
    }

    function nullText(value) {
        return value == null || value == "null" ? null : value;
    }

    // ---- Base ----

    function Decision(decision, state, send, options) {
        this.autoAccept = !!(options && options.autoAccept);
        this.id = decision.id;
        this.type = decision.type;
        this.text = decision.text || "";
        this.decision = decision;
        this.state = state;
        this.send = send;
        this.choiceCards = [];
        this.usesHand = false;
        this.note = null;
        this.sent = false;
    }

    Decision.prototype.isSelectable = function () {
        return false;
    };
    Decision.prototype.isSelected = function () {
        return false;
    };
    Decision.prototype.tap = function () {
    };
    Decision.prototype.choose = function () {
    };
    Decision.prototype.controls = function () {
        return [];
    };
    Decision.prototype.press = function () {
    };

    Decision.prototype.finish = function (value) {
        if (this.sent)
            return;
        this.sent = true;
        this.send("" + value);
    };

    function extend(Child) {
        Child.prototype = Object.create(Decision.prototype);
        Child.prototype.constructor = Child;
        return Child;
    }

    function isInHand(state, cardId) {
        var card = state.cards[cardId];
        return card != null && card.zone == "HAND";
    }

    // ---- INTEGER: a number between min and max ----

    var IntegerDecision = extend(function (decision, state, send, options) {
        Decision.call(this, decision, state, send, options);
        var min = intParam(decision, "min", 0);
        var max = intParam(decision, "max", 1000);
        var value = intParam(decision, "defaultValue", min);
        this.stepper = {value: Math.max(min, Math.min(max, value)), min: min, max: max};
    });

    IntegerDecision.prototype.controls = function () {
        return [{name: "done", label: "OK", primary: true}];
    };

    IntegerDecision.prototype.press = function (name) {
        var s = this.stepper;
        if (name == "dec")
            s.value = Math.max(s.min, s.value - 1);
        else if (name == "inc")
            s.value = Math.min(s.max, s.value + 1);
        else if (name == "done")
            this.finish(s.value);
    };

    // ---- MULTIPLE_CHOICE: one of several answers ----

    var MultipleChoiceDecision = extend(function (decision, state, send, options) {
        Decision.call(this, decision, state, send, options);
        this.results = params(decision, "results");
    });

    MultipleChoiceDecision.prototype.controls = function () {
        return this.results.map(function (result, i) {
            // All alike: highlighting the first one would look like a recommendation
            return {name: "choice:" + i, label: result, html: true};
        });
    };

    MultipleChoiceDecision.prototype.press = function (name) {
        if (name.indexOf("choice:") == 0)
            this.finish(parseInt(name.substring(7)));
    };

    // ---- Picking several cards: CARD_SELECTION (cards in play) and ARBITRARY_CARDS (cards shown just for this) ----

    function SelectionDecision(decision, state, send, options, ids, selectable) {
        Decision.call(this, decision, state, send, options);
        this.min = intParam(decision, "min", 0);
        this.max = intParam(decision, "max", ids.length);
        this.ids = ids;
        this.selectableIds = selectable;
        this.selected = [];
    }

    extend(SelectionDecision);

    SelectionDecision.prototype.isSelectable = function (id) {
        return this.selectableIds.indexOf(id) >= 0;
    };

    SelectionDecision.prototype.isSelected = function (id) {
        return this.selected.indexOf(id) >= 0;
    };

    // Tapping toggles a card; at the maximum, further cards can't be added until one is removed
    SelectionDecision.prototype.tap = function (id) {
        if (!this.isSelectable(id))
            return;
        var index = this.selected.indexOf(id);
        if (index >= 0)
            this.selected.splice(index, 1);
        else if (this.selected.length < this.max) {
            this.selected.push(id);
            if (this.autoAccept && this.selected.length == this.max)
                this.finish(this.answerValue());
        }
    };

    SelectionDecision.prototype.answerValue = function () {
        return this.selected.join(",");
    };

    SelectionDecision.prototype.controls = function () {
        var count = this.selected.length;
        var controls = [];
        if (count > 0)
            controls.push({name: "reset", label: "Reset"});
        var label = this.selectableIds.length == 0 ? "OK" : (count == 0 ? "Done" : "Done (" + count + ")");
        controls.push({name: "done", label: label, primary: true, disabled: count < this.min});
        return controls;
    };

    SelectionDecision.prototype.press = function (name) {
        if (name == "reset")
            this.selected = [];
        else if (name == "done" && this.selected.length >= this.min)
            this.finish(this.answerValue());
    };

    SelectionDecision.prototype.hint = function () {
        if (this.selectableIds.length == 0)
            return null;
        if (this.min == this.max)
            return "Choose " + this.min;
        return "Choose " + (this.min > 0 ? this.min + " to " : "up to ") + this.max;
    };

    var CardSelectionDecision = function (decision, state, send, options) {
        var ids = params(decision, "cardId");
        SelectionDecision.call(this, decision, state, send, options, ids, ids);
        this.usesHand = ids.some(function (id) {
            return isInHand(state, id);
        });
        this.note = this.hint();
    };
    CardSelectionDecision.prototype = Object.create(SelectionDecision.prototype);

    var ArbitraryCardsDecision = function (decision, state, send, options) {
        var ids = params(decision, "cardId");
        var selectable = params(decision, "selectable");
        var blueprints = params(decision, "blueprintId");
        var texts = params(decision, "testingText");
        var selectableIds = ids.filter(function (id, i) {
            return selectable[i] == "true";
        });
        SelectionDecision.call(this, decision, state, send, options, ids, selectableIds);
        this.choiceCards = ids.map(function (id, i) {
            return {id: id, blueprintId: blueprints[i], label: nullText(texts[i]), selectable: selectable[i] == "true"};
        });
        this.note = this.hint();
    };
    ArbitraryCardsDecision.prototype = Object.create(SelectionDecision.prototype);

    // ---- ACTION_CHOICE: one of several actions, each shown as a card ----

    var ActionChoiceDecision = extend(function (decision, state, send, options) {
        Decision.call(this, decision, state, send, options);
        var actionIds = params(decision, "actionId");
        var texts = params(decision, "actionText");
        this.choiceCards = params(decision, "blueprintId").map(function (blueprintId, i) {
            return {id: "action" + i, blueprintId: blueprintId, label: texts[i], selectable: true, actionId: actionIds[i]};
        });
        this.selectedId = null;
    });

    ActionChoiceDecision.prototype.isSelectable = function (id) {
        return id.indexOf("action") == 0;
    };

    ActionChoiceDecision.prototype.isSelected = function (id) {
        return id == this.selectedId;
    };

    ActionChoiceDecision.prototype.tap = function (id) {
        if (!this.isSelectable(id))
            return;
        this.selectedId = this.selectedId == id ? null : id;
        if (this.autoAccept && this.selectedId != null)
            this.finish(this.answerValue());
    };

    ActionChoiceDecision.prototype.answerValue = function () {
        var selected = this.selectedId;
        var card = this.choiceCards.filter(function (c) {
            return c.id == selected;
        })[0];
        return card ? card.actionId : "";
    };

    ActionChoiceDecision.prototype.controls = function () {
        return [{name: "done", label: "Done", primary: true, disabled: this.selectedId == null}];
    };

    ActionChoiceDecision.prototype.press = function (name) {
        if (name == "done" && this.selectedId != null)
            this.finish(this.answerValue());
    };

    // ---- CARD_ACTION_CHOICE: use a card (in play, in hand, or elsewhere), or pass ----

    var CardActionChoiceDecision = extend(function (decision, state, send, options) {
        Decision.call(this, decision, state, send, options);
        var cardIds = params(decision, "cardId");
        var blueprints = params(decision, "blueprintId");
        var actionIds = params(decision, "actionId");
        var texts = params(decision, "actionText");
        var texts2 = params(decision, "testingText");

        // card id -> its actions. Cards that aren't in play or in hand (blueprint other than "inPlay") are shown
        // in the choice strip as their own cards, like the desktop client's "virtual" cards.
        this.actions = {};
        this.order = [];
        for (var i = 0; i < cardIds.length; i++) {
            var id = blueprints[i] == "inPlay" ? cardIds[i] : "extra" + cardIds[i];
            if (!this.actions[id]) {
                this.actions[id] = [];
                this.order.push(id);
                if (blueprints[i] != "inPlay")
                    this.choiceCards.push({id: id, blueprintId: blueprints[i], label: nullText(texts2[i]), selectable: true});
            }
            this.actions[id].push({id: actionIds[i], text: texts[i]});
        }
        this.usesHand = this.order.some(function (id) {
            return isInHand(state, id);
        });
        this.selectedCard = null;
        this.selectedAction = null;
        this.pendingCard = null;
    });

    CardActionChoiceDecision.prototype.isSelectable = function (id) {
        return this.actions[id] != null;
    };

    CardActionChoiceDecision.prototype.isSelected = function (id) {
        return id == this.selectedCard;
    };

    CardActionChoiceDecision.prototype.tap = function (id) {
        var actions = this.actions[id];
        if (!actions)
            return;
        if (id == this.selectedCard) {
            this.selectedCard = null;
            this.selectedAction = null;
            return;
        }
        if (actions.length == 1) {
            this.selectedCard = id;
            this.selectedAction = actions[0].id;
            if (this.autoAccept)
                this.finish(this.selectedAction);
            return;
        }
        this.pendingCard = id;
        return {menu: actions};
    };

    CardActionChoiceDecision.prototype.choose = function (actionId) {
        if (this.pendingCard == null)
            return;
        this.selectedCard = this.pendingCard;
        this.selectedAction = actionId;
        this.pendingCard = null;
        if (this.autoAccept)
            this.finish(this.selectedAction);
    };

    CardActionChoiceDecision.prototype.selectedActionText = function () {
        var actions = this.actions[this.selectedCard] || [];
        for (var i = 0; i < actions.length; i++)
            if (actions[i].id == this.selectedAction)
                return actions[i].text;
        return null;
    };

    CardActionChoiceDecision.prototype.answerValue = function () {
        return this.selectedAction != null ? this.selectedAction : "";
    };

    CardActionChoiceDecision.prototype.controls = function () {
        if (this.selectedAction == null)
            return [{name: "pass", label: "Pass", primary: this.order.length == 0}];
        return [{name: "reset", label: "Reset"}, {name: "done", label: "Done", primary: true}];
    };

    CardActionChoiceDecision.prototype.press = function (name) {
        if (name == "pass")
            this.finish("");
        else if (name == "reset") {
            this.selectedCard = null;
            this.selectedAction = null;
        } else if (name == "done" && this.selectedAction != null)
            this.finish(this.selectedAction);
    };

    Object.defineProperty(CardActionChoiceDecision.prototype, "note", {
        get: function () {
            if (this.selectedAction != null)
                return "Selected: " + (this.selectedActionText() || "action");
            return this.order.length > 0 ? "Tap a highlighted card to use it, or pass." : null;
        },
        set: function () {
        }
    });

    // ---- ASSIGN_MINIONS: tap a minion, then the character it skirmishes ----

    var AssignMinionsDecision = extend(function (decision, state, send, options) {
        Decision.call(this, decision, state, send, options);
        this.freeCharacters = params(decision, "freeCharacters");
        this.minions = params(decision, "minions");
        this.assigned = {};             // minion -> character, for the minions of this decision
        for (var i = 0; i < this.minions.length; i++) {
            var minion = state.cards[this.minions[i]];
            if (minion && minion.assign != null && this.freeCharacters.indexOf(minion.assign) >= 0)
                this.assigned[this.minions[i]] = minion.assign;
        }
        this.original = Object.assign({}, this.assigned);
        this.pickedMinion = null;
        this.confirming = false;
        this.applyToState();
    });

    // The table shows the assignments as they are being made, as the desktop client does
    AssignMinionsDecision.prototype.applyToState = function () {
        for (var i = 0; i < this.minions.length; i++) {
            var minion = this.state.cards[this.minions[i]];
            if (minion)
                minion.assign = this.assigned[this.minions[i]] || null;
        }
    };

    AssignMinionsDecision.prototype.isSelectable = function (id) {
        if (this.pickedMinion != null)
            return this.freeCharacters.indexOf(id) >= 0 || id == this.pickedMinion;
        return this.minions.indexOf(id) >= 0;
    };

    AssignMinionsDecision.prototype.isSelected = function (id) {
        return id == this.pickedMinion;
    };

    AssignMinionsDecision.prototype.tap = function (id) {
        this.confirming = false;
        if (this.pickedMinion == null) {
            if (this.minions.indexOf(id) >= 0)
                this.pickedMinion = id;
            return;
        }
        if (id == this.pickedMinion)
            delete this.assigned[id];           // tapping the minion again unassigns it
        else if (this.freeCharacters.indexOf(id) >= 0)
            this.assigned[this.pickedMinion] = id;
        else
            return;
        this.pickedMinion = null;
        this.applyToState();
    };

    AssignMinionsDecision.prototype.unassignedCount = function () {
        var that = this;
        return this.minions.filter(function (m) {
            return !that.assigned[m];
        }).length;
    };

    // "char1 minionA minionB,char2,char3 minionC": every free character in order, with its minions
    AssignMinionsDecision.prototype.answerValue = function () {
        var that = this;
        return this.freeCharacters.map(function (character) {
            var parts = [character];
            for (var i = 0; i < that.minions.length; i++)
                if (that.assigned[that.minions[i]] == character)
                    parts.push(that.minions[i]);
            return parts.join(" ");
        }).join(",");
    };

    AssignMinionsDecision.prototype.controls = function () {
        if (this.confirming)
            return [{name: "back", label: "Keep assigning"}, {name: "send", label: "Send anyway", primary: true}];
        return [{name: "reset", label: "Reset"}, {name: "done", label: "Done", primary: true}];
    };

    AssignMinionsDecision.prototype.press = function (name) {
        if (name == "reset") {
            this.assigned = Object.assign({}, this.original);
            this.pickedMinion = null;
            this.confirming = false;
            this.applyToState();
        } else if (name == "done") {
            if (this.unassignedCount() > 0 && this.minions.length > 0)
                this.confirming = true;
            else
                this.finish(this.answerValue());
        } else if (name == "send") {
            this.finish(this.answerValue());
        } else if (name == "back") {
            this.confirming = false;
        }
    };

    Object.defineProperty(AssignMinionsDecision.prototype, "note", {
        get: function () {
            if (this.confirming) {
                var n = this.unassignedCount();
                return n + (n == 1 ? " minion is" : " minions are") + " not assigned. Send anyway?";
            }
            if (this.pickedMinion != null)
                return "Now tap the character it skirmishes (or the minion again to unassign it).";
            return "Tap a minion, then the character it skirmishes.";
        },
        set: function () {
        }
    });

    // ---- Creating them ----

    var TYPES = {
        INTEGER: IntegerDecision,
        MULTIPLE_CHOICE: MultipleChoiceDecision,
        CARD_SELECTION: CardSelectionDecision,
        ARBITRARY_CARDS: ArbitraryCardsDecision,
        ACTION_CHOICE: ActionChoiceDecision,
        CARD_ACTION_CHOICE: CardActionChoiceDecision,
        ASSIGN_MINIONS: AssignMinionsDecision
    };

    var MobileDecisions = {
        // decision: state.decision; send(value) is called once with the answer; options: {autoAccept}
        create: function (decision, state, send, options) {
            var Type = TYPES[decision.type];
            return Type ? new Type(decision, state, send, options) : null;
        },
        TYPES: Object.keys(TYPES)
    };

    root.MobileDecisions = MobileDecisions;
    if (typeof module !== "undefined" && module.exports)
        module.exports = MobileDecisions;
})(typeof window !== "undefined" ? window : this);
