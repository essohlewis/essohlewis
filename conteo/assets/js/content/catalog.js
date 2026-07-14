/* Conteo — Chargement + cache du catalogue statique.
 * Le catalogue est un simple JSON servi par CDN, pas une API. */

import { store } from '../core/store.js';
import { getSetting, setSetting } from '../core/db.js';

const CATALOG_URL = './data/catalog.json';
let _cache = null;

export async function loadCatalog() {
  if (_cache) return _cache;
  try {
    const res = await fetch(CATALOG_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    _cache = data;
    store.catalog = data;
    await setSetting('catalog_v', data.version);
    return data;
  } catch (err) {
    // Hors-ligne : le Service Worker sert la copie mise en cache.
    if (store.catalog) return store.catalog;
    throw err;
  }
}

export function talesForLevel(catalog, level) {
  return (catalog.tales || []).filter((tale) => tale.levels && tale.levels[level]);
}

export function getTale(catalog, slug) {
  return (catalog.tales || []).find((t) => t.slug === slug) || null;
}

export function getPack(catalog, packId) {
  return (catalog.packs || []).find((p) => p.id === packId) || null;
}

export function getLangLabel(catalog, code) {
  return (catalog.langs || []).find((l) => l.code === code)?.label || code;
}

export async function catalogVersion() {
  return getSetting('catalog_v', null);
}
