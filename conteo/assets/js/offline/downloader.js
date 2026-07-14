/* Conteo — Téléchargement d'un pack complet pour l'usage hors-ligne.
 * Rassemble toutes les URLs d'assets (manifests + médias) puis les met en
 * cache via le Service Worker, en suivant la progression dans IndexedDB. */

import { put, get } from '../core/db.js';
import { getPack, getTale } from '../content/catalog.js';
import { loadManifest } from '../content/manifest.js';
import { packCacheName, cachePackViaSW, deletePackCache } from './cache.js';
import { LEVELS } from '../content/level.js';

/* Construit la liste exhaustive des URLs d'un pack (tous niveaux confondus). */
export async function collectPackUrls(catalog, pack) {
  const urls = new Set();
  urls.add(pack.cover);
  for (const slug of pack.tales) {
    const tale = getTale(catalog, slug);
    if (!tale) continue;
    urls.add(tale.cover);
    for (const level of LEVELS) {
      const info = tale.levels?.[level];
      if (!info) continue;
      urls.add(info.manifest);
      try {
        const manifest = await loadManifest(tale, level);
        (manifest.assets || []).forEach((u) => urls.add(u));
        for (const a of Object.values(manifest.audio || {})) {
          if (a.src) urls.add(a.src);
          if (a.fallback) urls.add(a.fallback);
          if (a.timings) urls.add(a.timings);
        }
        (manifest.pages || []).forEach((p) => {
          if (p.image) urls.add(p.image);
          if (p.image_avif) urls.add(p.image_avif);
          (p.hotspots || []).forEach((h) => {
            if (h.sfx) urls.add(h.sfx);
            Object.values(h.voice || {}).forEach((v) => urls.add(v));
          });
        });
        (manifest.games || []).forEach((g) => {
          (g.options || []).forEach((o) => o.image && urls.add(o.image));
          (g.images || []).forEach((im) => urls.add(im));
          if (g.question_audio) urls.add(g.question_audio);
        });
      } catch { /* manifest manquant en dev : on ignore */ }
    }
  }
  return [...urls].filter(Boolean);
}

export async function downloadPack(catalog, packId, { onProgress } = {}) {
  const pack = getPack(catalog, packId);
  if (!pack) throw new Error('Pack inconnu : ' + packId);
  const cacheName = packCacheName(packId);

  const urls = await collectPackUrls(catalog, pack);
  await put('downloads', {
    pack_id: packId, status: 'downloading',
    downloaded_bytes: 0, total_bytes: 0, cache_name: cacheName,
    files_total: urls.length, files_done: 0
  });

  await cachePackViaSW(cacheName, urls, async (done, total) => {
    onProgress?.(done, total);
    // Mise à jour périodique (toutes les ~10 unités) pour limiter les écritures.
    if (done % 10 === 0 || done === total) {
      await put('downloads', {
        pack_id: packId, status: done === total ? 'complete' : 'downloading',
        downloaded_bytes: 0, total_bytes: 0, cache_name: cacheName,
        files_total: total, files_done: done
      });
    }
  });

  await put('downloads', {
    pack_id: packId, status: 'complete', cache_name: cacheName,
    files_total: urls.length, files_done: urls.length,
    completed_at: Date.now()
  });
  return { cacheName, count: urls.length };
}

export async function removePack(packId) {
  const dl = await get('downloads', packId);
  if (dl?.cache_name) await deletePackCache(dl.cache_name);
  await put('downloads', { pack_id: packId, status: 'pending', cache_name: dl?.cache_name });
}

export async function packStatus(packId) {
  const dl = await get('downloads', packId);
  return dl?.status || 'pending';
}
