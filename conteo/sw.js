/* Conteo — Service Worker écrit à la main (sans Workbox).
 *
 * Deux couches de cache :
 *   1. SHELL_CACHE : le squelette de l'app (HTML/CSS/JS/data de base).
 *      Stratégie « stale-while-revalidate » pour rester à jour sans bloquer.
 *   2. Caches par pack : « conteo-pack-<id>-v<n> », remplis par downloader.js
 *      via postMessage. Le SW les sert en priorité (cache-first) pour l'offline.
 *
 * Les médias CDN (images/audio) sont servis cache-first : une fois vus, ils
 * restent disponibles hors-ligne.
 */

const SHELL_VERSION = 'conteo-shell-v1';
const RUNTIME_MEDIA = 'conteo-media-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/kid.css',
  './assets/css/reader.css',
  './assets/css/games.css',
  './assets/css/parent.css',
  './assets/js/main.js',
  './assets/js/core/router.js',
  './assets/js/core/store.js',
  './assets/js/core/db.js',
  './assets/js/core/dom.js',
  './assets/js/core/i18n.js',
  './assets/js/content/catalog.js',
  './assets/js/content/manifest.js',
  './assets/js/content/level.js',
  './assets/js/audio/narrator.js',
  './assets/js/audio/sfx.js',
  './assets/js/audio/recorder.js',
  './assets/js/audio/unlock.js',
  './assets/js/audio/speech.js',
  './assets/js/offline/downloader.js',
  './assets/js/offline/cache.js',
  './assets/js/offline/storage.js',
  './assets/js/billing/iap.js',
  './assets/js/billing/codes.js',
  './assets/js/billing/entitlements.js',
  './assets/js/utils/format.js',
  './assets/js/utils/screen-time.js',
  './assets/js/utils/a11y.js',
  './assets/js/utils/pwa.js',
  './data/catalog.json',
  './assets/icons/favicon.svg',
  './assets/icons/192.png',
  './assets/icons/512.png',
  './assets/icons/512-mask.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {
        // En dev, certains assets manquent : on tolère les échecs individuels.
        return Promise.all(SHELL_ASSETS.map((u) => cache.add(u).catch(() => null)));
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('conteo-shell-') && k !== SHELL_VERSION)
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isMedia(url) {
  return /\.(webp|avif|png|jpg|jpeg|svg|opus|m4a|mp3|woff2)$/i.test(url.pathname) ||
         url.hostname === 'cdn.conteo.ci';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navigations : réseau d'abord, repli sur le shell puis offline.html.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('./index.html').then((r) => r || caches.match('./offline.html'))
      )
    );
    return;
  }

  // Médias : cache-first (y compris les caches de packs).
  if (isMedia(url)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_MEDIA).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // Shell / data : stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Communication avec downloader.js : mise en cache d'un pack dans un cache nommé.
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  if (type === 'CACHE_PACK') {
    const { cacheName, urls } = payload;
    event.waitUntil(
      caches.open(cacheName).then(async (cache) => {
        let done = 0;
        for (const u of urls) {
          try { await cache.add(u); } catch (_) { /* asset manquant en dev */ }
          done++;
          event.source && event.source.postMessage({
            type: 'PACK_PROGRESS', payload: { cacheName, done, total: urls.length }
          });
        }
        event.source && event.source.postMessage({
          type: 'PACK_DONE', payload: { cacheName }
        });
      })
    );
  }
  if (type === 'DELETE_PACK') {
    event.waitUntil(caches.delete(payload.cacheName));
  }
  if (type === 'SKIP_WAITING') self.skipWaiting();
});
