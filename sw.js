// Kurodoko offline worker. VERSION is stamped by the build; it changes on every release.
const VERSION = "kurodoko-v6";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png",
  "./fonts/figtree-latin-500-normal.woff2", "./fonts/figtree-latin-600-normal.woff2",
  "./fonts/figtree-latin-700-normal.woff2", "./fonts/figtree-latin-800-normal.woff2",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
// On upgrade: drop old app files and reload any open copy of the app, so a stale page heals itself.
// Puzzles are in local storage, which this never touches.
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k !== VERSION);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    if (old.length) {
      for (const c of await self.clients.matchAll({ type: "window" })) { try { c.navigate(c.url); } catch (err) {} }
    }
  })());
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("/sw.js")) return; // always live
  if (req.mode === "navigate") {
    // network first (3s), stored copy when offline or slow
    e.respondWith(caches.open(VERSION).then((cache) => {
      const net = fetch(req, { cache: "no-store" }).then((res) => {
        if (res && res.ok) cache.put("./index.html", res.clone());
        return res;
      });
      const slow = new Promise((r) => setTimeout(r, 3000)).then(() => cache.match("./index.html"));
      return Promise.race([net, slow]).then((r) => r || net).catch(() => cache.match("./index.html"));
    }));
    return;
  }
  e.respondWith(caches.open(VERSION).then((cache) =>
    cache.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }))
  ));
});
