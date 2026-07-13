/**
 * CONTEO — Service Worker (écrit à la main, sans Workbox).
 *
 * Stratégies :
 *   - Shell app (HTML/CSS/JS/icônes/polices) : cache-first, précaché à l'install.
 *   - Manifests JSON de contes : stale-while-revalidate.
 *   - Médias de packs (images/audio) : cache-first (caches nommés conteo-pack-*).
 *   - API : network-first, jamais mis en cache (données dynamiques + auth).
 */

const SHELL_CACHE = 'conteo-shell-v1';
const MANIFEST_CACHE = 'conteo-manifests-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/tokens.css',
  '/assets/css/base.css',
  '/assets/css/kid.css',
  '/assets/css/parent.css',
  '/assets/js/app.js',
  '/assets/js/core/router.js',
  '/assets/js/core/store.js',
  '/assets/js/core/api.js',
  '/assets/js/core/db.js',
  '/assets/js/audio/narrator.js',
  '/assets/js/audio/sfx.js',
  '/assets/js/offline/cache.js',
  '/assets/js/offline/downloader.js',
  '/assets/js/utils/dom.js',
  '/assets/js/utils/sync.js',
  '/assets/js/views/kid/library.js',
  '/assets/js/views/kid/reader.js',
  '/assets/js/views/kid/hotspots.js',
  '/assets/js/views/kid/games.js',
  '/assets/js/views/kid/bedtime.js',
  '/assets/js/views/auth.js',
  '/assets/js/views/parent/shell.js',
  '/assets/js/views/parent/gate.js',
  '/assets/js/views/parent/dashboard.js',
  '/assets/js/views/parent/profiles.js',
  '/assets/js/views/parent/downloads.js',
  '/assets/js/views/parent/billing.js',
  '/assets/js/views/parent/settings.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k === 'conteo-shell-v1' ? false : k.startsWith('conteo-shell'))
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API : network-first, sans cache (auth + données dynamiques).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req).catch(() => new Response(
      JSON.stringify({ ok: false, error: 'offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Manifests de contes : stale-while-revalidate.
  if (url.pathname.includes('/media/') && url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(req, MANIFEST_CACHE));
    return;
  }

  // Médias (images/audio) : cache-first (packs téléchargés).
  if (url.pathname.includes('/media/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Shell & navigation : cache-first, repli index.html pour les routes SPA.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((c) => c || fetch(req))
    );
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return caches.match('/index.html');
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

// Background Sync : signale au client de rejouer la file de synchronisation.
self.addEventListener('sync', (event) => {
  if (event.tag === 'conteo-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'flush-sync' }));
      })
    );
  }
});
