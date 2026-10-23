// Mobile or standard view: phones and tablets get the mobile pages (hall-mobile.html, game-mobile.html) unless the
// player chose the standard view, which is remembered on the device. Computers always get the standard pages.
//
// The standard pages call GempView.redirectToMobile(...) early in <head>; the mobile pages offer "Standard view".
// Adding ?view=standard to a standard page's address shows it once without switching (the mobile pages link to the
// standard hall's tabs that way).

var GempView = (function () {

    var COOKIE = "gempView";

    function readCookie() {
        var parts = document.cookie ? document.cookie.split("; ") : [];
        for (var i = 0; i < parts.length; i++)
            if (parts[i].indexOf(COOKIE + "=") == 0)
                return parts[i].substring(COOKIE.length + 1);
        return null;
    }

    function urlAsksForStandard() {
        return /[?&]view=standard(&|$)/.test(window.location.search);
    }

    return {
        // A phone or tablet: a touch screen as the main input, and no side longer than a small laptop's
        isMobileDevice: function () {
            var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
            var shortSide = Math.min(window.screen.width, window.screen.height);
            return !!coarse && shortSide < 1100;
        },

        // "mobile", "standard", or null when the player never chose
        preference: function () {
            var value = readCookie();
            return value == "mobile" || value == "standard" ? value : null;
        },

        wantsMobile: function () {
            var preference = this.preference();
            return preference == "mobile" || (preference == null && this.isMobileDevice());
        },

        choose: function (view) {
            var expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString();
            document.cookie = COOKIE + "=" + view + "; expires=" + expires + "; path=/";
        },

        // On a standard page: go to its mobile version (same address parameters) when the mobile view applies
        redirectToMobile: function (mobilePage) {
            if (urlAsksForStandard() || !this.wantsMobile())
                return false;
            window.location.replace(mobilePage + window.location.search + window.location.hash);
            return true;
        },

        // Switches view and opens the matching page
        switchTo: function (view, page) {
            this.choose(view);
            window.location.href = page;
        },

        // On a standard page seen on a phone or tablet: a small button back to the mobile view
        offerMobileSwitch: function (mobilePage) {
            var that = this;
            if (!this.isMobileDevice())
                return;
            var add = function () {
                var button = document.createElement("button");
                button.type = "button";
                button.textContent = "📱 Mobile view";
                button.setAttribute("style", "position:fixed;right:12px;bottom:12px;z-index:100000;padding:12px 16px;"
                    + "font-size:16px;border-radius:8px;border:1px solid #d1a94d;background:#2a2112;color:#f3e6c8;"
                    + "box-shadow:0 2px 10px rgba(0,0,0,.6)");
                button.addEventListener("click", function () {
                    that.switchTo("mobile", mobilePage + window.location.search.replace(/[?&]view=standard/, "").replace(/^&/, "?") + window.location.hash);
                });
                document.body.appendChild(button);
            };
            if (document.body)
                add();
            else
                document.addEventListener("DOMContentLoaded", add);
        }
    };
})();
