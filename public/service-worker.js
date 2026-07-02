/**
 * Service Worker Transouscris — coquille d'application (app shell) + mode dégradé.
 *
 * Stratégie :
 *  - Navigation : réseau d'abord, repli sur le cache puis page hors-ligne.
 *  - Statique   : cache d'abord (stale-while-revalidate léger).
 *  - Les POST (recharges) ne sont PAS mis en cache : ils sont mis en file
 *    d'attente côté page (IndexedDB dans app.js) et rejoués à la reconnexion.
 */
const CACHE = 'transouscris-v1';
const APP_SHELL = ['/', '/dashboard', '/recharge', '/wallet', '/assets/js/app.js', '/offline'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL.filter(Boolean))).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return; // POST géré par la file d'attente applicative

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(request, copy));
                    return res;
                })
                .catch(() => caches.match(request).then((r) => r || caches.match('/')))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request))
    );
});
