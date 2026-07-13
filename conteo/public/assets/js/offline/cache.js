/**
 * CONTEO — Aides Cache API pour le contenu hors-ligne.
 * Chaque pack a son cache nommé (conteo-pack-{id}) afin de pouvoir être
 * supprimé sélectivement.
 */

export const SHELL_CACHE = 'conteo-shell-v1';
export const MANIFEST_CACHE = 'conteo-manifests-v1';

export function packCacheName(packId) {
  return `conteo-pack-${packId}`;
}

/** Met en cache une liste d'URLs dans un cache nommé, avec callback de progression. */
export async function cacheAssets(cacheName, urls, onProgress) {
  const cache = await caches.open(cacheName);
  let done = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) await cache.put(url, res.clone());
    } catch {
      /* asset indisponible : on continue, il sera retélé plus tard */
    }
    done++;
    if (onProgress) onProgress(done, urls.length);
  }
}

/** Supprime le cache d'un pack. */
export async function deletePackCache(packId) {
  return caches.delete(packCacheName(packId));
}

/** Estimation de l'espace de stockage. */
export async function storageInfo() {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const { usage, quota } = await navigator.storage.estimate();
  return { usage: usage || 0, quota: quota || 0 };
}

/** Demande un stockage persistant (évite l'éviction du cache). */
export async function requestPersistent() {
  if (navigator.storage?.persist) {
    return navigator.storage.persist();
  }
  return false;
}
