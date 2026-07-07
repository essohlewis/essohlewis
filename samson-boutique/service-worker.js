/* =====================================================================
   SAMSON BOUTIQUE — Service Worker (PWA)
   Stratégie : precache de la coquille + "network-first" avec repli cache,
   pour permettre la navigation du catalogue hors-ligne.
   ===================================================================== */
const CACHE = 'samson-boutique-v1';

const ASSETS = [
  './',
  'index.html', 'catalogue.html', 'produit.html', 'panier.html', 'checkout.html',
  'compte.html', 'suivi.html', 'contact.html', 'a-propos.html', 'cgv.html', 'confidentialite.html',
  'manifest.json',
  'assets/css/variables.css', 'assets/css/base.css', 'assets/css/components.css',
  'assets/css/layout.css', 'assets/css/themes.css',
  'assets/js/data/products.js',
  'assets/js/modules/storage.js', 'assets/js/modules/security.js', 'assets/js/modules/toast.js',
  'assets/js/modules/theme.js', 'assets/js/modules/wishlist.js', 'assets/js/modules/cart.js',
  'assets/js/modules/search.js', 'assets/js/modules/catalog.js', 'assets/js/modules/product.js',
  'assets/js/modules/checkout.js', 'assets/js/modules/payment.js', 'assets/js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Les polices Google : cache-first (opaque, pas bloquant)
  if (req.url.includes('fonts.g')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => r)));
    return;
  }

  // Network-first pour le reste, repli sur le cache (mode hors-ligne)
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
