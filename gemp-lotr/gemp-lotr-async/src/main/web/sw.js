// GEMP service worker: makes the site installable as an app (PWA).
//
// It only ever handles the site's own static files under /gemp-lotr/ and always asks the server first, so players
// get updates immediately; the saved copy is used only when the network is down. Game and server calls
// (/gemp-lotr-server/...) and card images from other hosts are never touched.

var CACHE_NAME = "gemp-static-v1";
var OFFLINE_PAGE = "/gemp-lotr/offline.html";

var PRECACHE = [
    OFFLINE_PAGE,
    "/gemp-lotr/images/icons/android-chrome-192x192.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(PRECACHE);
            })
            .then(function () {
                return self.skipWaiting();
            }));
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (names) {
                return Promise.all(names
                    .filter(function (name) {
                        return name.indexOf("gemp-static-") == 0 && name != CACHE_NAME;
                    })
                    .map(function (name) {
                        return caches.delete(name);
                    }));
            })
            .then(function () {
                return self.clients.claim();
            }));
});

// One saved copy per file: game.html?gameId=1 and game.html?gameId=2 share an entry
function cacheKey(request) {
    var url = new URL(request.url);
    return url.origin + url.pathname;
}

function isStaticRequest(request) {
    if (request.method != "GET")
        return false;
    var url = new URL(request.url);
    return url.origin == self.location.origin
        && url.pathname.indexOf("/gemp-lotr/") == 0
        && url.pathname.indexOf("/gemp-lotr/share/") != 0;
}

self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (!isStaticRequest(request))
        return;

    event.respondWith(
        fetch(request)
            .then(function (response) {
                if (response.ok && response.type == "basic") {
                    var copy = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(cacheKey(request), copy);
                    });
                }
                return response;
            })
            .catch(function () {
                return caches.match(cacheKey(request))
                    .then(function (cached) {
                        if (cached)
                            return cached;
                        if (request.mode == "navigate")
                            return caches.match(OFFLINE_PAGE);
                        return Response.error();
                    });
            }));
});
