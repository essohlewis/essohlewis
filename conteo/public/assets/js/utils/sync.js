/**
 * CONTEO — Synchronisation différée.
 *
 * Toute écriture (progression, temps d'écran) est d'abord persistée localement,
 * puis empilée dans sync_queue (IndexedDB). Au retour de connexion (ou via
 * Background Sync), la file est rejouée vers l'API. Résolution de conflit :
 * last-write-wins sur last_read_at (géré côté serveur par GREATEST()).
 */

import { db } from '../core/db.js';
import { api } from '../core/api.js';
import { state } from '../core/store.js';

/** Empile une requête à rejouer. */
export async function queueWrite(method, path, body) {
  await db.enqueue({ method, path, body });
  if (state.online) flush();
}

let flushing = false;

/** Rejoue la file. Idempotent : les items réussis sont retirés. */
export async function flush() {
  if (flushing || !state.online || !state.token) return;
  flushing = true;
  try {
    const items = await db.queueAll();
    for (const item of items) {
      try {
        await api[item.method.toLowerCase() === 'post' ? 'post' : 'patch'](item.path, item.body);
        await db.dequeue(item.id);
      } catch (err) {
        if (err.offline) break;      // toujours hors-ligne : on réessaiera
        // Erreur applicative (4xx) non récupérable : on retire pour ne pas boucler.
        if (err.status && err.status >= 400 && err.status < 500) {
          await db.dequeue(item.id);
        } else {
          break;
        }
      }
    }
  } finally {
    flushing = false;
  }
}

/** Branche le flush automatique au retour de connexion. */
export function initSync() {
  window.addEventListener('online', () => { state.online = true; flush(); });
  window.addEventListener('offline', () => { state.online = false; });
  if (state.online) flush();
}
