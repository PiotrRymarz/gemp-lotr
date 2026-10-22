// Registers the service worker that lets GEMP be installed as an app (see /gemp-lotr/sw.js)
if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("/gemp-lotr/sw.js", {scope: "/gemp-lotr/"})
            .catch(function (error) {
                console.log("Service worker registration failed: " + error);
            });
    });
}
