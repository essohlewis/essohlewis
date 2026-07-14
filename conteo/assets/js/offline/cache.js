/* Conteo — Caches nommés par pack (Cache API), pilotés via le Service Worker.
 * Chaque pack a son cache « conteo-pack-<id>-v<n> » : suppression sélective simple. */

export function packCacheName(packId, version = 1) {
  return `conteo-pack-${packId}-v${version}`;
}

function swReady() {
  return navigator.serviceWorker?.ready ?? Promise.reject(new Error('SW indisponible'));
}

/* Demande au SW de mettre en cache une liste d'URLs, avec progression. */
export function cachePackViaSW(cacheName, urls, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const reg = await swReady();
      const target = reg.active || navigator.serviceWorker.controller;
      if (!target) throw new Error('Service Worker inactif');

      const onMsg = (e) => {
        const { type, payload } = e.data || {};
        if (payload?.cacheName !== cacheName) return;
        if (type === 'PACK_PROGRESS') onProgress?.(payload.done, payload.total);
        if (type === 'PACK_DONE') {
          navigator.serviceWorker.removeEventListener('message', onMsg);
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener('message', onMsg);
      target.postMessage({ type: 'CACHE_PACK', payload: { cacheName, urls } });
    } catch (err) { reject(err); }
  });
}

export async function deletePackCache(cacheName) {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'DELETE_PACK', payload: { cacheName } });
  }
  // Suppression directe aussi (fenêtre a accès à caches).
  if (self.caches) { try { await caches.delete(cacheName); } catch {} }
}

export async function packCacheSize(cacheName) {
  if (!self.caches) return 0;
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let bytes = 0;
    for (const req of keys) {
      const res = await cache.match(req);
      const len = res?.headers.get('content-length');
      if (len) bytes += Number(len);
    }
    return bytes;
  } catch { return 0; }
}
