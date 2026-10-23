// Settings of the mobile game screen, kept on the device.
//
// Where the desktop client has the same setting it uses the same cookie, so a change on one shows on the other.
// Auto-pass is done by the server, from the "autoPassPhases" cookie. The desktop saves that cookie for /gemp-lotr
// only, so it never reaches the server (/gemp-lotr-server); here it is also saved for "/", which does.

var MobileSettings = (function () {

    var PHASES = ["FELLOWSHIP", "SHADOW", "MANEUVER", "ARCHERY", "ASSIGNMENT", "SKIRMISH", "REGROUP"];
    // The server's own default when it gets no cookie (GameRequestHandler)
    var DEFAULT_AUTO_PASS = ["FELLOWSHIP", "MANEUVER", "ARCHERY", "ASSIGNMENT", "REGROUP"];

    function readCookie(name) {
        var parts = document.cookie ? document.cookie.split("; ") : [];
        for (var i = 0; i < parts.length; i++) {
            var eq = parts[i].indexOf("=");
            if (parts[i].substring(0, eq) == name)
                return decodeURIComponent(parts[i].substring(eq + 1));
        }
        return null;
    }

    function writeCookie(name, value, path) {
        var expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString();
        document.cookie = name + "=" + encodeURIComponent(value) + "; expires=" + expires + (path ? "; path=" + path : "");
    }

    function readLocal(name, fallback) {
        try {
            var value = window.localStorage.getItem("gemp-mobile-" + name);
            return value == null ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function writeLocal(name, value) {
        try {
            window.localStorage.setItem("gemp-mobile-" + name, value);
        } catch (e) {
            // storage unavailable (private window): the setting lasts for this page only
        }
    }

    function Settings() {
        var phases = readCookie("autoPassPhases");
        this.autoPassPhases = phases == null ? DEFAULT_AUTO_PASS.slice() : phases.split("0").filter(function (p) {
            return PHASES.indexOf(p) >= 0;
        });
        // Desktop defaults auto-accept to on; on a touch screen a stray tap would then play a card, so here it is
        // off until the player turns it on (on either screen)
        this.autoAccept = readCookie("autoAccept") == "true";
        this.autoDismissDeckReveal = readCookie("autoDismissDeckReveal") == "true";
        this.sound = readLocal("sound", "true") == "true";
        this.vibrate = readLocal("vibrate", "true") == "true";
        this.timerAlerts = readLocal("timerAlerts", "true") == "true";
        // Make sure the server sees the phases shown here (see the comment at the top)
        this.saveAutoPass();
    }

    Settings.PHASES = PHASES;

    Settings.prototype.saveAutoPass = function () {
        var value = this.autoPassPhases.join("0");
        writeCookie("autoPassPhases", value, "/gemp-lotr");
        if (value) {
            writeCookie("autoPassPhases", value, "/");
            writeCookie("autoPass", "true", "/");
        } else {
            // An empty list would make the server fail (Phase.valueOf("")): it has its own switch for "never"
            document.cookie = "autoPassPhases=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
            writeCookie("autoPass", "false", "/");
        }
    };

    Settings.prototype.setAutoPass = function (phase, on) {
        var index = this.autoPassPhases.indexOf(phase);
        if (on && index < 0)
            this.autoPassPhases.push(phase);
        else if (!on && index >= 0)
            this.autoPassPhases.splice(index, 1);
        this.autoPassPhases.sort(function (a, b) {
            return PHASES.indexOf(a) - PHASES.indexOf(b);
        });
        this.saveAutoPass();
    };

    Settings.prototype.set = function (name, value) {
        this[name] = value;
        if (name == "autoAccept" || name == "autoDismissDeckReveal")
            writeCookie(name, "" + value, "/gemp-lotr");
        else
            writeLocal(name, "" + value);
    };

    return Settings;
})();
