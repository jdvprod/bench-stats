/* Benchboard offline support: the app keeps working in gyms with no Wi-Fi. */
const CACHE = "benchboard-%VERSION%";
const CORE = ["./", "./index.html", "./app.js", "./app.css", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.hostname === "api.anthropic.com") return;
  // Network first for the app itself so updates arrive; cached copy when offline.
  if (req.mode === "navigate" || url.origin === location.origin) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? "./index.html" : req, copy)); } return r; })
      .catch(() => caches.match(req.mode === "navigate" ? "./index.html" : req, { ignoreSearch: true })));
    return;
  }
  // Fonts: cached copy first. Everything else (cloud sync, AI) always goes to the network.
  if (!/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; })));
});
