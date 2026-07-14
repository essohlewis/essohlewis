/* Conteo — Wrapper IndexedDB promisifié (base « conteo », version 1). */

const DB_NAME = 'conteo';
const DB_VERSION = 1;
let _dbPromise = null;

export function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('progress')) {
        const s = db.createObjectStore('progress', { keyPath: ['profile_id', 'tale_slug'] });
        s.createIndex('by_profile', 'profile_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('screen_time')) {
        const s = db.createObjectStore('screen_time', { keyPath: ['profile_id', 'date'] });
        s.createIndex('by_profile', 'profile_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('recordings')) {
        const s = db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_profile', 'profile_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('downloads')) {
        db.createObjectStore('downloads', { keyPath: 'pack_id' });
      }
      if (!db.objectStoreNames.contains('entitlements')) {
        db.createObjectStore('entitlements', { keyPath: 'pack_id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(store, mode) {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}
const wrap = (req) => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});

/* CRUD génériques */
export const put = (store, value) => tx(store, 'readwrite').then((s) => wrap(s.put(value)));
export const add = (store, value) => tx(store, 'readwrite').then((s) => wrap(s.add(value)));
export const get = (store, key) => tx(store, 'readonly').then((s) => wrap(s.get(key)));
export const del = (store, key) => tx(store, 'readwrite').then((s) => wrap(s.delete(key)));
export const getAll = (store) => tx(store, 'readonly').then((s) => wrap(s.getAll()));

export function getAllByIndex(store, index, value) {
  return tx(store, 'readonly').then((s) => wrap(s.index(index).getAll(value)));
}

export function clearStore(store) { return tx(store, 'readwrite').then((s) => wrap(s.clear())); }

/* Aides settings (clé/valeur) */
export async function getSetting(key, fallback = undefined) {
  const row = await get('settings', key);
  return row ? row.value : fallback;
}
export function setSetting(key, value) { return put('settings', { key, value }); }

/* Export complet pour la sauvegarde JSON (sans les Blobs binaires par défaut) */
export async function exportAll({ includeRecordings = false } = {}) {
  const [profiles, progress, screen_time, downloads, entitlements, settings] = await Promise.all([
    getAll('profiles'), getAll('progress'), getAll('screen_time'),
    getAll('downloads'), getAll('entitlements'), getAll('settings')
  ]);
  const dump = { profiles, progress, screen_time, downloads, entitlements, settings };
  if (includeRecordings) {
    const recs = await getAll('recordings');
    dump.recordings = recs.map((r) => ({ ...r, blob: undefined }));  // métadonnées seules
  }
  return {
    app: 'conteo', schema: DB_VERSION,
    exported_at: new Date().toISOString(),
    data: dump
  };
}

/* Import (remplace le contenu des stores fournis) */
export async function importAll(dump) {
  if (!dump || dump.app !== 'conteo' || !dump.data) throw new Error('Fichier de sauvegarde invalide');
  const stores = ['profiles', 'progress', 'screen_time', 'downloads', 'entitlements', 'settings'];
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    t.oncomplete = resolve; t.onerror = () => reject(t.error);
    for (const name of stores) {
      const rows = dump.data[name];
      if (!Array.isArray(rows)) continue;
      const os = t.objectStore(name);
      os.clear();
      for (const r of rows) os.put(r);
    }
  });
}
