/* ===========================================================
   SAMSON GYM — Service Worker (PWA)
   Stratégie :
   - Navigations (pages HTML) : réseau d'abord, repli sur le cache
     puis sur la page hors-ligne. Le planning reste consultable
     même sans connexion.
   - Ressources statiques (CSS/JS/images/polices) : cache d'abord,
     mise à jour en arrière-plan (stale-while-revalidate).
   =========================================================== */

const VERSION = 'samson-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

// Ressources indispensables pré-mises en cache à l'installation.
const PRECACHE = [
  './',
  'index.html',
  'cours.html',
  'coachs.html',
  'tarifs.html',
  'equipements.html',
  'contact.html',
  'offline.html',
  'css/style.css',
  'js/script.js',
  'manifest.json',
  'assets/favicon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Pages HTML : réseau d'abord, repli cache puis hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('offline.html')))
    );
    return;
  }

  // Google Fonts : cache d'abord (mise en cache runtime).
  const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

  // Ressources statiques : stale-while-revalidate.
  if (url.origin === self.location.origin || isFont) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
