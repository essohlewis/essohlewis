/* ==========================================================================
   service-worker.js — Cache applicatif pour un fonctionnement hors-ligne (PWA).
   Stratégie : "cache d'abord" pour les ressources statiques de l'app.
   NB : ignoré lorsque l'app est ouverte via file:// (nécessite http/https).
   ========================================================================== */
const CACHE = "coachlink-v1";

const RESSOURCES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/variables.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/pages.css",
  "./js/utils/dom.js",
  "./js/utils/format.js",
  "./js/utils/validation.js",
  "./js/utils/i18n.js",
  "./js/utils/icons.js",
  "./js/data/seed.js",
  "./js/services/storageService.js",
  "./js/services/notificationService.js",
  "./js/services/coachService.js",
  "./js/services/authService.js",
  "./js/services/bookingService.js",
  "./js/services/messageService.js",
  "./js/services/socialService.js",
  "./js/components/toast.js",
  "./js/components/modal.js",
  "./js/components/ui.js",
  "./js/components/coachCard.js",
  "./js/components/layout.js",
  "./js/pages/home.js",
  "./js/pages/auth.js",
  "./js/pages/search.js",
  "./js/pages/profile.js",
  "./js/pages/howItWorks.js",
  "./js/pages/client.js",
  "./js/pages/coach.js",
  "./js/pages/admin.js",
  "./js/pages/messages.js",
  "./js/pages/settings.js",
  "./js/app.js",
];

// Installation : mise en cache des ressources.
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(RESSOURCES)).then(() => self.skipWaiting()));
});

// Activation : nettoyage des anciens caches.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Requêtes : cache d'abord, repli réseau.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((rep) => rep || fetch(e.request).then((reseau) => {
      return caches.open(CACHE).then((c) => { try { c.put(e.request, reseau.clone()); } catch (_) {} return reseau; });
    }).catch(() => caches.match("./index.html")))
  );
});
