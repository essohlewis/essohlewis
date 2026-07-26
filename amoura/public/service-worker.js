/* =============================================================================
   Amoura — Service Worker (PWA, feuille de route Phase 2)
   Stratégie :
     - Coquille applicative et assets statiques : cache-first (rapide, hors-ligne).
     - Requêtes API / navigation : network-first avec repli hors-ligne.
   Ne met JAMAIS en cache les requêtes non-GET ni les WebSockets.
   ========================================================================== */
const VERSION = "amoura-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PRECACHE = [
  "/assets/css/app.css",
  "/assets/css/tokens.css",
  "/assets/js/api.js",
  "/assets/js/app.js",
  "/assets/img/logo.svg",
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
