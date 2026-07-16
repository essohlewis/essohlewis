/* ==========================================================================
   service-worker.js — Cache applicatif pour un fonctionnement hors-ligne (PWA).
   Stratégie : "réseau d'abord" (network-first) → l'app affiche TOUJOURS la
   dernière version en ligne, et bascule sur le cache uniquement hors-ligne.
   NB : ignoré lorsque l'app est ouverte via file:// (nécessite http/https).
   ========================================================================== */
const CACHE = "coachlink-v3";

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

// Requêtes : RÉSEAU D'ABORD (met à jour le cache), repli cache si hors-ligne.
// Garantit que toute modification (CSS/JS) est affichée immédiatement.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((reseau) => {
        // Copie la réponse fraîche dans le cache pour l'usage hors-ligne.
        const copie = reseau.clone();
        caches.open(CACHE).then((c) => { try { c.put(e.request, copie); } catch (_) {} });
        return reseau;
      })
      .catch(() => caches.match(e.request).then((rep) => rep || caches.match("./index.html")))
  );
});
