'use strict';

/**
 * validateUrl.js
 * -----------------------------------------------------------------------------
 * Middleware de validation stricte des URL entrantes.
 *
 * Objectifs de sécurité :
 *   - Refuser tout ce qui n'est pas une URL http(s) bien formée.
 *   - N'autoriser que des domaines explicitement whitelistés (anti-SSRF).
 *   - Rejeter les hôtes internes / adresses IP privées.
 *   - Empêcher l'injection de caractères shell dans l'URL.
 */

// Domaines autorisés (et leurs sous-domaines) — whitelist stricte.
const ALLOWED_HOSTS = [
  'youtube.com',
  'youtu.be',
  'm.youtube.com',
  'music.youtube.com',
  'tiktok.com',
  'vm.tiktok.com',
  'instagram.com',
  'facebook.com',
  'fb.watch',
  'm.facebook.com',
  'twitter.com',
  'x.com',
  'vimeo.com',
  'dailymotion.com',
  'dai.ly',
];

/**
 * Vérifie qu'un hostname correspond à un domaine autorisé (ou un de ses
 * sous-domaines), sans se faire piéger par des suffixes trompeurs.
 * Ex : "youtube.com.evil.com" NE doit PAS passer.
 * @param {string} hostname
 * @returns {boolean}
 */
function isAllowedHost(hostname) {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return ALLOWED_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

/**
 * Détecte les hôtes internes / plages IP privées (protection SSRF basique).
 * @param {string} hostname
 * @returns {boolean}
 */
function isInternalHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // IPv4 privées / loopback / link-local.
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  // IPv6 loopback / ULA.
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd')) return true;
  return false;
}

/**
 * Middleware Express. Attend `req.body.url`, le nettoie et le valide.
 * En cas de succès, place l'URL nettoyée dans `req.validatedUrl`.
 */
function validateUrl(req, res, next) {
  const raw = req.body && req.body.url;

  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({
      error: 'URL_MANQUANTE',
      message: 'Veuillez fournir une URL valide.',
    });
  }

  const trimmed = raw.trim();

  // Longueur raisonnable + pas de caractères de contrôle / injection.
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return res.status(400).json({
      error: 'URL_INVALIDE',
      message: "L'URL fournie est invalide ou trop longue.",
    });
  }
  // Interdit les caractères susceptibles d'injection shell / retours ligne.
  if (/[\s<>"'`;|&$(){}\\]/.test(trimmed)) {
    return res.status(400).json({
      error: 'URL_INVALIDE',
      message: "L'URL contient des caractères non autorisés.",
    });
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_e) {
    return res.status(400).json({
      error: 'URL_INVALIDE',
      message: "L'URL fournie n'est pas correctement formée.",
    });
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return res.status(400).json({
      error: 'PROTOCOLE_NON_AUTORISE',
      message: 'Seules les URL http(s) sont acceptées.',
    });
  }

  if (isInternalHost(parsed.hostname)) {
    return res.status(400).json({
      error: 'HOTE_NON_AUTORISE',
      message: 'Cette adresse ne peut pas être traitée.',
    });
  }

  if (!isAllowedHost(parsed.hostname)) {
    return res.status(400).json({
      error: 'PLATEFORME_NON_SUPPORTEE',
      message:
        "Cette plateforme n'est pas prise en charge. Plateformes supportées : YouTube, TikTok, Instagram, Facebook, X, Vimeo, Dailymotion.",
    });
  }

  req.validatedUrl = parsed.toString();
  next();
}

module.exports = validateUrl;
module.exports.isAllowedHost = isAllowedHost;
module.exports.isInternalHost = isInternalHost;
module.exports.ALLOWED_HOSTS = ALLOWED_HOSTS;
