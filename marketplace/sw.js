/* =========================================================================
   sw.js — Service Worker : rend Marché CI installable et disponible hors ligne.
   Stratégie : cache-first pour la coquille de l'app, avec repli réseau.
   NB : les Service Workers nécessitent un contexte sécurisé (http/https) ; en
   ouverture directe via file://, ils ne s'enregistrent pas (dégradation propre).
   ========================================================================= */

const CACHE = "marchesci-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/theme.css",
  "./css/style.css",
  "./css/responsive.css",
  "./js/db.js",
  "./js/qr.js",
  "./js/ui.js",
  "./js/notifications.js",
  "./js/auth.js",
  "./js/store.js",
  "./js/products.js",
  "./js/security.js",
  "./js/kyc.js",
  "./js/coupons.js",
  "./js/messages.js",
  "./js/cart.js",
  "./js/orders.js",
  "./js/seed.js",
  "./js/router.js",
  "./js/app.js",
  "./assets/icon.svg",
  "./assets/placeholder.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Ne jamais mettre en cache l'API de vérification (backend PHP) : réseau direct.
  if (e.request.url.indexOf("/backend/") !== -1) return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match("./index.html"))
    )
  );
});
