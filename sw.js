/* ============================================================
   HIDECOR SiteLog — service worker
   The app shell is precached so SiteLog opens with no signal at all,
   which is the normal condition inside a building under fit-out.
   Bump CACHE on every release; old caches are cleared on activate.
   ============================================================ */
const CACHE = "sitelog-v1.0.0";
const SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./favicon.png",
  "./css/app.css",
  "./js/core.js",
  "./js/pdf.js",
  "./js/report.js",
  "./js/app.js",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-256.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/badge-96.png",
  "./icons/pdf-logo.jpg"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll fails the whole install if one file 404s, so add individually
    await Promise.all(SHELL.map(u => c.add(u).catch(err => console.warn("skip", u, err))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (err) { }
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network briefly so an updated shell is picked up,
  // fall back to the cached page, then to the offline notice.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const pre = await e.preloadResponse;
        if (pre) { putCopy(req, pre.clone()); return pre; }
        const net = await fetch(req);
        putCopy(req, net.clone());
        return net;
      } catch (err) {
        const c = await caches.open(CACHE);
        return (await c.match("./index.html")) || (await c.match("./offline.html")) ||
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  // Everything else: cache first — the shell never changes within a release.
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const net = await fetch(req);
      if (net && net.status === 200 && net.type === "basic") putCopy(req, net.clone());
      return net;
    } catch (err) {
      return new Response("", { status: 504 });
    }
  })());
});

function putCopy(req, res) {
  caches.open(CACHE).then(c => c.put(req, res)).catch(() => { });
}
