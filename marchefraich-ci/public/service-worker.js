/*
 * Service worker MarchéFraîch CI
 * Stratégie simple adaptée à une connexion mobile instable :
 *  - Assets statiques (CSS/JS/icônes) : cache-first.
 *  - Navigations (pages) : network-first avec repli sur une page hors-ligne.
 * Les requêtes POST (commandes, connexions) ne sont jamais mises en cache.
 */

const CACHE = 'marchefraich-v1';
const ASSETS = [
  './css/app.css',
  './js/app.js',
  './manifest.webmanifest',
  './hors-ligne.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cles) =>
      Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ne gérer que le GET ; laisser passer les POST directement au réseau.
  if (request.method !== 'GET') {
    return;
  }

  // Navigation de page : réseau d'abord, repli hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./hors-ligne.html'))
    );
    return;
  }

  // Assets : cache d'abord, sinon réseau (et on met en cache).
  event.respondWith(
    caches.match(request).then((enCache) => {
      return (
        enCache ||
        fetch(request).then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copie));
          return reponse;
        }).catch(() => enCache)
      );
    })
  );
});
