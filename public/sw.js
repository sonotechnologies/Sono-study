/* Sono Study service worker.
 * - Static build assets and fonts: cache-first (they're content-hashed).
 * - Pages: network-first, falling back to the last copy seen on this phone, then /offline.
 * - Everything else (server actions, RSC payloads, APIs, payments): network only.
 * - Push: shows reminders sent by the server and opens the right screen when tapped.
 * - Mocks: the exam page asks to be saved ("warm", ported from SonoCBT's exam
 *   service worker) so it reopens with no connection; answers live in IndexedDB.
 */
const VERSION = "v3";
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

const isAsset = (u) => u.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?)$/.test(u.pathname);
const isMockPage = (u) => /^\/mock\/[^/]+\/?$/.test(u.pathname);

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "warm" && Array.isArray(msg.urls)) {
    // The mock page lists its own URL and every file it uses: files first, the page last.
    event.waitUntil(
      (async () => {
        const pages = await caches.open(PAGE_CACHE);
        const assets = await caches.open(STATIC_CACHE);
        const urls = [...new Set(msg.urls)]
          .map((u) => {
            try {
              return new URL(u, self.location.origin);
            } catch {
              return null;
            }
          })
          .filter((u) => u && u.origin === self.location.origin);
        let missed = 0;
        await Promise.all(
          urls.filter(isAsset).map(async (u) => {
            try {
              if (await assets.match(u.href)) return;
              const res = await fetch(u.href);
              if (res.ok) await assets.put(u.href, res);
              else missed++;
            } catch {
              missed++;
            }
          }),
        );
        for (const u of urls.filter(isMockPage)) {
          try {
            const res = await fetch(u.href, { credentials: "same-origin" });
            if (res.ok && !res.redirected) await pages.put(u.href, res);
            else missed++;
          } catch {
            missed++;
          }
        }
        event.source?.postMessage({ type: "warmed", ok: missed === 0 });
      })(),
    );
  } else if (msg.type === "forget" && msg.url) {
    // Submitted: the saved mock page is no longer needed.
    event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.delete(new URL(msg.url, self.location.origin).href)));
  }
});

self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "Sono Study", {
      body: msg.body || "",
      tag: msg.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: msg.url || "/home" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/home", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = open.find((c) => c.url === url) || open.find((c) => new URL(c.url).origin === self.location.origin);
      if (same) {
        await same.focus();
        if (same.url !== url && "navigate" in same) await same.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
