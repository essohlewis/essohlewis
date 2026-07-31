/* =====================================================================
   GuideRecharge CI — Service Worker (PWA / cache hors-ligne)
   Stratégie : cache-first pour les assets statiques, network-first pour
   les pages HTML (afin d'avoir les données à jour), repli hors-ligne.
   ===================================================================== */
const CACHE = 'grc-cache-v1';

// Ressources mises en cache à l'installation (assets « app shell »).
const PRECACHE = [
    'assets/css/style.css',
    'assets/js/app.js',
    'assets/img/icon.svg',
    'manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Nettoie les anciens caches.
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // On ne gère que les GET ; on laisse passer les POST (API générateur).
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Ne pas mettre en cache les appels API (données dynamiques).
    if (url.pathname.includes('/api/')) return;

    // Assets statiques : cache-first.
    if (/\.(css|js|svg|png|jpg|jpeg|webp|woff2?)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(req).then((cached) =>
                cached || fetch(req).then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
                    return res;
                }).catch(() => cached)
            )
        );
        return;
    }

    // Pages HTML : network-first, repli sur le cache.
    event.respondWith(
        fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
        }).catch(() => caches.match(req).then((cached) => cached || caches.match('./')))
    );
});
