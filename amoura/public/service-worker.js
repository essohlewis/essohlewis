/* =============================================================================
   Amoura — Service Worker (PWA, feuille de route Phase 2)
   Stratégie :
     - Coquille applicative et assets statiques : cache-first (rapide, hors-ligne).
     - Requêtes API / navigation : network-first avec repli hors-ligne.
   Ne met JAMAIS en cache les requêtes non-GET ni les WebSockets.
   ========================================================================== */
const VERSION = "amoura-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PRECACHE = [
  "/assets/css/app.css",
  "/assets/css/tokens.css",
  "/assets/js/api.js",
  "/assets/js/app.js",
  "/assets/js/pwa.js",
  "/assets/img/logo.svg",
  "/assets/img/icon-192.png",
  "/assets/img/avatar-placeholder.svg",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // POST/PUT/… toujours réseau
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // ne gère que le même domaine

  // Assets statiques : cache-first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetchAndCache(request))
    );
    return;
  }

  // API : network-first, sans mise en cache (données fraîches).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ ok: false, error: "offline" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )));
    return;
  }

  // Navigation : network-first avec repli hors-ligne.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
});

function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  });
}

/* ---- Notifications Web Push ---- */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || "Amoura";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/assets/img/icon-192.png",
      badge: "/assets/img/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/app" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url.includes(url) && "focus" in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
