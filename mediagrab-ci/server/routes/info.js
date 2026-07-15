'use strict';

/**
 * routes/info.js
 * -----------------------------------------------------------------------------
 * POST /api/info
 * Reçoit { url }, renvoie les métadonnées + formats disponibles.
 */

const express = require('express');
const validateUrl = require('../middleware/validateUrl');
const { infoLimiter } = require('../middleware/rateLimiter');
const extractor = require('../services/extractor');

const router = express.Router();

router.post('/', infoLimiter, validateUrl, async (req, res) => {
  const url = req.validatedUrl;

  try {
    const info = await extractor.getInfo(url);

    if (!info.formats.video.length && !info.formats.audio.length) {
      return res.status(422).json({
        error: 'AUCUN_FORMAT',
        message:
          "Aucun format téléchargeable n'a été trouvé pour cette vidéo. Elle est peut-être protégée ou indisponible.",
      });
    }

    return res.json({ success: true, data: info });
  } catch (err) {
    const raw = (err && (err.stderr || err.message || '')).toString().toLowerCase();

    // On traduit les erreurs yt-dlp fréquentes en messages non techniques.
    if (raw.includes('private') || raw.includes('login') || raw.includes('sign in')) {
      return res.status(403).json({
        error: 'VIDEO_PRIVEE',
        message: 'Cette vidéo est privée ou nécessite une connexion. Impossible de la récupérer.',
      });
    }
    if (raw.includes('unavailable') || raw.includes('not available') || raw.includes('removed')) {
      return res.status(404).json({
        error: 'VIDEO_INDISPONIBLE',
        message: "Cette vidéo n'est plus disponible ou a été supprimée.",
      });
    }
    if (raw.includes('unsupported url') || raw.includes('no video')) {
      return res.status(422).json({
        error: 'PLATEFORME_NON_SUPPORTEE',
        message: "Ce lien n'est pas pris en charge ou ne contient pas de vidéo téléchargeable.",
      });
    }
    if (raw.includes('timed out') || err.killed) {
      return res.status(504).json({
        error: 'DELAI_DEPASSE',
        message: "L'analyse a pris trop de temps. Vérifiez votre connexion et réessayez.",
      });
    }

    // eslint-disable-next-line no-console
    console.error('[info] Erreur extraction :', raw.slice(0, 500));
    return res.status(500).json({
      error: 'ERREUR_EXTRACTION',
      message: "Une erreur est survenue lors de l'analyse de la vidéo. Réessayez plus tard.",
    });
  }
});

module.exports = router;
