/* =============================================================================
   history.js — Historique de session via localStorage
   Aucune donnée personnelle : uniquement titre, miniature, plateforme et URL
   des dernières vidéos analysées. Effaçable par l'utilisateur.
   ========================================================================== */

const STORAGE_KEY = 'mediagrab_history';
const MAX_ITEMS = 12;

/**
 * Lit l'historique depuis localStorage (tolérant aux erreurs / mode privé).
 * @returns {Array<object>}
 */
export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

/**
 * Ajoute une entrée en tête d'historique (déduplication par URL).
 * @param {object} entry { url, title, thumbnail, platform }
 * @returns {Array<object>} le nouvel historique
 */
export function addHistory(entry) {
  if (!entry || !entry.url) return getHistory();

  const item = {
    url: entry.url,
    title: entry.title || 'Sans titre',
    thumbnail: entry.thumbnail || null,
    platform: entry.platform || 'autre',
    at: Date.now(),
  };

  const current = getHistory().filter((h) => h.url !== item.url);
  current.unshift(item);
  const trimmed = current.slice(0, MAX_ITEMS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_e) {
    /* quota / mode privé : on ignore silencieusement */
  }
  return trimmed;
}

/**
 * Vide l'historique.
 */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_e) {
    /* ignore */
  }
}
