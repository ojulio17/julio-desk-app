/* Shell cache only; data under d/ is always network (never cached). */
var CACHE = "desk-shell-v1";
var SHELL = ["./", "index.html", "app.css", "app.js", "chart.js", "manifest.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (u.origin !== location.origin || u.pathname.indexOf("/d/") !== -1) return; // data: network only
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); return r; })
    .catch(function () { return caches.match(e.request); }));
});
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data.json(); } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || "Desk", { body: d.body || "", data: { url: d.url } }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var u = e.notification.data && e.notification.data.url;
  if (u && u.indexOf("https://fomo.family/") === 0) e.waitUntil(clients.openWindow(u));
});
