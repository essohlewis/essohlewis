/* =============================================================================
   api.js — Couche d'accès au back-end (fetch)
   ========================================================================== */

// Base configurable : par défaut le même hôte que le front (serveur unique).
const API_BASE = '';

/**
 * Appelle POST /api/info pour récupérer les métadonnées d'une URL.
 * @param {string} url
 * @returns {Promise<object>} les données de la vidéo (data)
 * @throws {Error} avec une propriété `.userMessage` en français
 */
export async function fetchInfo(url) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (_networkErr) {
    throw makeError(
      'ERREUR_RESEAU',
      'Connexion impossible. Vérifiez votre connexion internet et réessayez.'
    );
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch (_e) {
    /* corps non-JSON */
  }

  if (!res.ok) {
    const message =
      (payload && payload.message) ||
      "Une erreur est survenue lors de l'analyse. Réessayez plus tard.";
    throw makeError((payload && payload.error) || 'ERREUR', message);
  }

  return payload.data;
}

/**
 * Construit l'URL de téléchargement (GET) pour un format donné.
 * On utilise un GET direct via <a> pour une meilleure UX (barre de
 * téléchargement native du navigateur, surtout sur mobile).
 *
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.formatId
 * @param {string} [params.title]
 * @param {string} [params.sourceFormatId]
 * @returns {string}
 */
export function buildDownloadUrl({ url, formatId, title, sourceFormatId }) {
  const q = new URLSearchParams({ url, formatId });
  if (title) q.set('title', title);
  if (sourceFormatId) q.set('sourceFormatId', sourceFormatId);
  return `${API_BASE}/api/download?${q.toString()}`;
}

/**
 * Crée un objet Error enrichi d'un message utilisateur.
 * @param {string} code
 * @param {string} userMessage
 * @returns {Error}
 */
function makeError(code, userMessage) {
  const err = new Error(userMessage);
  err.code = code;
  err.userMessage = userMessage;
  return err;
}
