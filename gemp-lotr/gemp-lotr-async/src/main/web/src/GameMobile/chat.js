// The game's chat room on the mobile game screen ("Game<gameId>", the same room as the desktop client's chat tab).
// It uses the desktop client's chat calls and polls every 3 seconds, as the desktop game screen does.

var MobileChat = (function () {

    var POLL_MS = 3000;
    var MAX_MESSAGES = 300;

    function Chat(comm, room, onChange) {
        this.comm = comm;
        this.room = room;
        this.onChange = onChange;
        this.messages = [];     // {from, text, kind: "chat" | "system" | "warning"}
        this.users = [];
        this.unread = 0;
        this.open = false;      // while the chat is on screen, new messages aren't counted as unread
        this.broken = null;     // why the chat stopped, if it did
        this.started = false;
    }

    Chat.prototype.start = function () {
        if (this.started)
            return;
        this.started = true;
        var that = this;
        this.comm.startChat(this.room, function (xml) {
            that.process(xml, false);
        }, this.errorMap());
    };

    Chat.prototype.poll = function () {
        var that = this;
        clearTimeout(this.timer);
        this.timer = setTimeout(function () {
            if (that.broken)
                return;
            that.comm.updateChat(that.room, function (xml) {
                that.process(xml, true);
            }, that.errorMap());
        }, POLL_MS);
    };

    Chat.prototype.process = function (xml, countUnread) {
        var root = xml.documentElement;
        if (root.tagName != "chat")
            return;
        var messages = root.getElementsByTagName("message");
        for (var i = 0; i < messages.length; i++) {
            var from = messages[i].getAttribute("from");
            // The server sends the text ready to show (the desktop chat inserts it the same way)
            var text = messages[i].textContent;
            this.messages.push({from: from, text: text, kind: from == "System" ? "system" : "chat"});
            if (countUnread && !this.open && from != "System")
                this.unread++;
        }
        if (this.messages.length > MAX_MESSAGES)
            this.messages.splice(0, this.messages.length - MAX_MESSAGES);

        var users = root.getElementsByTagName("user");
        this.users = [];
        for (var j = 0; j < users.length; j++)
            this.users.push((users[j].textContent || "").replace(/^[*+] /, ""));

        if (messages.length > 0 || users.length > 0)
            this.onChange();
        this.poll();
    };

    Chat.prototype.send = function (text) {
        text = text.trim();
        if (!text || this.broken)
            return;
        this.comm.sendChatMessage(this.room, text, this.errorMap());
    };

    Chat.prototype.markRead = function () {
        this.unread = 0;
    };

    Chat.prototype.stop = function (reason) {
        this.broken = reason;
        clearTimeout(this.timer);
        this.messages.push({from: "", text: reason, kind: "warning"});
        this.onChange();
    };

    Chat.prototype.errorMap = function () {
        var that = this;
        var stop = function (reason) {
            return function () {
                if (!that.broken)
                    that.stop(reason);
            };
        };
        return {
            "0": function () {
                // A dropped connection: try again a little later instead of giving up
                if (!that.broken)
                    that.poll();
            },
            "401": stop("You are not logged in, so the chat is off."),
            "403": stop("You can't take part in this chat."),
            "404": stop("The chat room is closed."),
            "410": stop("You were inactive for too long and left the chat. Reload the page to rejoin.")
        };
    };

    return Chat;
})();
