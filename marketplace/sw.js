/* =========================================================================
   sw.js — Service Worker : rend Marché CI installable et disponible hors ligne.
   Stratégie : cache-first pour la coquille de l'app, avec repli réseau.
   NB : les Service Workers nécessitent un contexte sécurisé (http/https) ; en
   ouverture directe via file://, ils ne s'enregistrent pas (dégradation propre).
   ========================================================================= */

const CACHE = "marchesci-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/theme.css",
  "./css/style.css",
  "./css/responsive.css",
  "./shared/catalogue.js",
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
  "./js/api.js",
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
  const url = e.request.url;
  // Réseau direct (jamais de cache) pour l'API et les pages back-office Node.
  if (url.indexOf("/api/") !== -1 || url.indexOf("/verify") !== -1 || url.indexOf("/admin/") !== -1 || url.indexOf("/mes-commandes") !== -1 || url.indexOf("/mes-ventes") !== -1 || url.indexOf("/paiement") !== -1 || url.indexOf("/facture") !== -1 || url.indexOf("/securite") !== -1 || url.indexOf("/mot-de-passe") !== -1) return;
  // Scripts & styles : réseau d'abord (évite de servir une version périmée), cache en repli.
  if (/\.(?:js|css)(?:\?|$)/.test(url)) {
    e.respondWith(
      fetch(e.request)
        .then((resp) => { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return resp; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return resp;
        })
        // Repli index.html uniquement pour les navigations (jamais pour js/css/images).
        .catch(() => (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error()))
    )
  );
});
