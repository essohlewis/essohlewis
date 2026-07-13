/**
 * CONTEO — Téléchargement de packs pour usage hors-ligne.
 *
 * 1) GET /packs/{slug}/download → liste des assets + estimation de taille
 * 2) Vérifie l'espace via navigator.storage.estimate()
 * 3) Demande le stockage persistant
 * 4) Télécharge séquentiellement avec barre de progression (cache.put)
 * 5) Enregistre le pack comme « disponible hors-ligne » dans IndexedDB
 */

import { api } from '../core/api.js';
import { db } from '../core/db.js';
import { cacheAssets, packCacheName, storageInfo, requestPersistent, deletePackCache } from './cache.js';

/**
 * @param {object} pack  { id, slug, title, total_size_mb }
 * @param {(pct:number)=>void} onProgress
 */
export async function downloadPack(pack, onProgress) {
  const plan = await api.get(`/packs/${encodeURIComponent(pack.slug)}/download`);
  const assets = plan.assets || [];

  // Vérification de l'espace disponible.
  const { usage, quota } = await storageInfo();
  const needed = plan.total_bytes_est || (pack.total_size_mb || 0) * 1024 * 1024;
  if (quota && needed && usage + needed > quota) {
    throw new Error('Espace de stockage insuffisant.');
  }

  await requestPersistent();

  await cacheAssets(packCacheName(pack.id), assets, (done, total) => {
    if (onProgress) onProgress(Math.round((done / total) * 100));
  });

  await db.savePack({
    id: pack.id,
    slug: pack.slug,
    title: pack.title,
    asset_count: assets.length,
    size_bytes: needed,
    downloaded_at: Date.now(),
  });

  if (onProgress) onProgress(100);
}

/** Supprime un pack téléchargé (cache + entrée IndexedDB). */
export async function removePack(packId) {
  await deletePackCache(packId);
  await db.delPack(packId);
}

/** Liste des packs disponibles hors-ligne. */
export async function offlinePacks() {
  return db.allPacks();
}
