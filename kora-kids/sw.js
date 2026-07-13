/* Service Worker — KORA KIDS
   Stratégie cache-first : après le premier chargement, aucune requête réseau. */

const CACHE = "kora-kids-v5";

/* Coquille + tous les modules et données à mettre en cache dès l'installation. */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/reset.css",
  "./css/tokens.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/scenes.css",
  "./js/main.js",
  "./js/core/router.js",
  "./js/core/audio.js",
  "./js/core/storage.js",
  "./js/core/input.js",
  "./js/core/a11y.js",
  "./js/core/art.js",
  "./js/core/assets.js",
  "./js/scenes/home.js",
  "./js/scenes/map.js",
  "./js/scenes/parent.js",
  "./js/scenes/reward.js",
  "./js/scenes/avatar.js",
  "./js/games/animaux.js",
  "./js/games/marche.js",
  "./js/games/balafon.js",
  "./js/games/coloriage.js",
  "./js/games/alphabet.js",
  "./js/games/formes.js",
  "./js/games/memory.js",
  "./js/games/puzzle.js",
  "./js/data/animaux.json",
  "./js/data/alphabet.json",
  "./js/data/marche.json",
  "./js/data/config.json",
  "./assets/manifest.json",
  "./assets/img/ui/icon.svg",
  "./assets/fonts/fredoka-latin.woff2",
  "./assets/fonts/fredoka-latin-ext.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll échoue si un seul asset manque ; on tolère les assets optionnels.
    await Promise.all(SHELL.map(async (url) => {
      try { await cache.add(new Request(url, { cache: "reload" })); }
      catch (_) { /* asset optionnel absent — ignoré */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Met en cache à la volée les assets média chargés par jeu.
      if (res.ok && res.type === "basic") {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (_) {
      // Hors-ligne et non caché : on renvoie la coquille si navigation.
      if (req.mode === "navigate") return caches.match("./index.html");
      return new Response("", { status: 504 });
    }
  })());
});
