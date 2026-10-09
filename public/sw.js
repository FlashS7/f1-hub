// F1 HUB service worker: instant app shell + last known pages offline.
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

const PRECACHE = ["/", "/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API calls: league state must be live.
  if (url.pathname.startsWith("/api/")) return;

  // Hashed build assets and fonts never change: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pages (incl. RSC payloads for client navigation): network first, fall back to the last copy.
  const isPage = req.mode === "navigate" || req.headers.get("RSC") === "1";
  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && req.mode === "navigate") {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          // A failed RSC fetch makes Next fall back to a full navigation, which lands below.
          if (req.mode !== "navigate") return Response.error();
          return (await caches.match(req)) || (await caches.match("/offline")) || Response.error();
        }),
    );
  }
});

// ---------- push reminders ----------
self.addEventListener("push", (event) => {
  let data = { title: "F1 HUB", body: "A session starts soon.", url: "/", tag: "f1hub" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
