/* =====================================================================
   service-worker.js — Cache hors-ligne (PWA)
   Stratégie : "cache first" pour les assets statiques (app shell),
   "network first" avec repli cache pour la navigation.
   Incrémenter CACHE_VERSION à chaque déploiement pour purger l'ancien.
   ===================================================================== */
const CACHE_VERSION = 'pronosai-v2';
const APP_SHELL = [
  './',
  './index.html',
  './auth.html',
  './dashboard.html',
  './css/variables.css',
  './css/style.css',
  './css/dashboard.css',
  './js/theme.js',
  './js/i18n.js',
  './js/data.js',
  './js/predictions.js',
  './js/live.js',
  './js/bankroll.js',
  './js/notifications.js',
  './js/community.js',
  './js/main.js',
  './js/auth.js',
  './js/dashboard.js',
  './assets/logo.svg',
  './assets/icon.svg',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigation : network-first (contenu frais) avec repli cache/offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Assets : cache-first
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((res) => {
        // Ne mettre en cache que les réponses valides same-origin
        if (res.ok && new URL(request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
