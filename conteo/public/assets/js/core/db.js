/**
 * CONTEO — Wrapper IndexedDB (Promises, aucune dépendance).
 *
 * Stores :
 *   - kv            : préférences, session, droits (clé libre)
 *   - profiles      : profils enfants (miroir local)
 *   - progress      : progression de lecture (clé child_id:tale_id)
 *   - recordings    : enregistrements vocaux (Blob) — JAMAIS synchronisés
 *   - packs         : packs disponibles hors-ligne
 *   - sync_queue    : écritures en attente de synchronisation (auto-increment)
 */

const DB_NAME = 'conteo';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const result = fn(s);
    t.oncomplete = () => resolve(result?.__value ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqValue(request) {
  const box = { __value: undefined };
  request.onsuccess = () => { box.__value = request.result; };
  return box;
}

export const db = {
  // ── Key-Value générique ──
  get: (key) => tx('kv', 'readonly', (s) => reqValue(s.get(key))),
  set: (key, value) => tx('kv', 'readwrite', (s) => { s.put(value, key); }),
  del: (key) => tx('kv', 'readwrite', (s) => { s.delete(key); }),

  // ── Profils ──
  saveProfiles: (list) => tx('profiles', 'readwrite', (s) => {
    s.clear();
    list.forEach((p) => s.put(p));
  }),
  allProfiles: () => tx('profiles', 'readonly', (s) => reqValue(s.getAll())),

  // ── Progression ──
  saveProgress: (childId, taleId, data) => tx('progress', 'readwrite', (s) => {
    s.put({ key: `${childId}:${taleId}`, child_id: childId, tale_id: taleId, ...data });
  }),
  getProgress: (childId, taleId) => tx('progress', 'readonly', (s) => reqValue(s.get(`${childId}:${taleId}`))),
  allProgress: () => tx('progress', 'readonly', (s) => reqValue(s.getAll())),

  // ── Enregistrements vocaux (local uniquement) ──
  addRecording: (rec) => tx('recordings', 'readwrite', (s) => reqValue(s.add(rec))),
  allRecordings: () => tx('recordings', 'readonly', (s) => reqValue(s.getAll())),
  delRecording: (id) => tx('recordings', 'readwrite', (s) => { s.delete(id); }),

  // ── Packs hors-ligne ──
  savePack: (pack) => tx('packs', 'readwrite', (s) => { s.put(pack); }),
  allPacks: () => tx('packs', 'readonly', (s) => reqValue(s.getAll())),
  delPack: (id) => tx('packs', 'readwrite', (s) => { s.delete(id); }),

  // ── File de synchronisation différée ──
  enqueue: (item) => tx('sync_queue', 'readwrite', (s) => { s.add({ ...item, ts: Date.now() }); }),
  queueAll: () => tx('sync_queue', 'readonly', (s) => reqValue(s.getAll())),
  dequeue: (id) => tx('sync_queue', 'readwrite', (s) => { s.delete(id); }),
};
