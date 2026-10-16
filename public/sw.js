/* Sono Study service worker.
 * - Static build assets and fonts: cache-first (they're content-hashed).
 * - Pages: network-first, falling back to the last copy seen on this phone, then /offline.
 * - Everything else (server actions, RSC payloads, APIs, payments): network only.
 * Offline mocks and flashcards add their own caches in later milestones.
 */
const VERSION = "v1";
const STATIC_CACHE = `sono-static-${VERSION}`;
const PAGE_CACHE = `sono-pages-${VERSION}`;
const PRECACHE = ["/offline", "/icon-192.png", "/manifest.webmanifest"];
const MAX_PAGES = 30;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sono-") && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/billing/") || url.pathname.startsWith("/i/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches
              .open(PAGE_CACHE)
              .then((c) => c.put(req, copy))
              .then(() => trim(PAGE_CACHE, MAX_PAGES));
          }
          return res;
        })
        .catch(async () => (await caches.match(req, { cacheName: PAGE_CACHE })) || (await caches.match("/offline"))),
    );
  }
});
