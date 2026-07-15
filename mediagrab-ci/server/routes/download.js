'use strict';

/**
 * routes/download.js
 * -----------------------------------------------------------------------------
 * POST /api/download
 * Reçoit { url, formatId }, relaie le flux vidéo/audio en streaming vers le
 * client via Content-Disposition: attachment. Rien n'est stocké sur le serveur.
 *
 * On accepte GET en plus de POST : cela permet de déclencher le téléchargement
 * directement via une balise <a href> côté front (meilleure UX mobile), les
 * paramètres passant alors en query string.
 */

const express = require('express');
const validateUrl = require('../middleware/validateUrl');
const { downloadLimiter } = require('../middleware/rateLimiter');
const extractor = require('../services/extractor');

const router = express.Router();

/**
 * Nettoie un titre pour en faire un nom de fichier sûr.
 * @param {string} title
 * @returns {string}
 */
function safeFilename(title) {
  return (title || 'video')
    .replace(/[^\p{L}\p{N}\-_ ]/gu, '') // lettres/chiffres/espaces/-/_
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'video';
}

/**
 * Handler commun GET/POST. La validation d'URL a déjà eu lieu (middleware).
 */
async function handleDownload(req, res) {
  const url = req.validatedUrl;
  const source = req.method === 'GET' ? req.query : req.body;
  const formatId = (source.formatId || '').toString();
  const title = (source.title || '').toString();

  if (!formatId) {
    return res.status(400).json({
      error: 'FORMAT_MANQUANT',
      message: 'Aucun format sélectionné pour le téléchargement.',
    });
  }

  // Détermine le mode (audio vs vidéo) et l'extension de sortie.
  let opts;
  let ext;
  if (formatId === 'audio-mp3' || formatId === 'audio-m4a') {
    ext = formatId === 'audio-mp3' ? 'mp3' : 'm4a';
    opts = {
      audioOnly: true,
      audioExt: ext,
      sourceFormatId: (source.sourceFormatId || 'bestaudio').toString(),
    };
  } else {
    ext = 'mp4';
    // On borne la valeur formatId à un jeu de caractères sûr (déjà pas de shell
    // metacaractères, mais on reste prudent : chiffres, +, -, . et lettres).
    if (!/^[\w.+-]+$/.test(formatId)) {
      return res.status(400).json({
        error: 'FORMAT_INVALIDE',
        message: 'Le format demandé est invalide.',
      });
    }
    opts = { audioOnly: false, formatId };
  }

  const filename = `${safeFilename(title)}.${ext}`;

  // En-têtes de téléchargement. On n'annonce pas de Content-Length : le flux
  // est généré à la volée (taille finale inconnue, surtout après conversion).
  res.setHeader('Content-Type', opts.audioOnly
    ? (ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4')
    : 'video/mp4');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  res.setHeader('Cache-Control', 'no-store');

  let child;
  try {
    child = extractor.streamDownload(url, opts);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[download] Impossible de lancer yt-dlp :', err.message);
    if (!res.headersSent) {
      if (err && err.code === 'YTDLP_INTROUVABLE') {
        return res.status(503).json({
          error: 'YTDLP_INTROUVABLE',
          message:
            "Le service de téléchargement n'est pas disponible pour le moment. (Administrateur : yt-dlp n'est pas installé sur le serveur — voir le README.)",
        });
      }
      return res.status(500).json({
        error: 'ERREUR_TELECHARGEMENT',
        message: "Impossible de démarrer le téléchargement. Réessayez plus tard.",
      });
    }
    return undefined;
  }

  let stderrTail = '';
  child.stderr.on('data', (d) => {
    // On conserve seulement la fin de stderr pour le diagnostic.
    stderrTail = (stderrTail + d.toString()).slice(-2000);
  });

  // Relais du flux média vers le client.
  child.stdout.pipe(res);

  // Sécurité : timeout global sur le process de téléchargement.
  const killTimer = setTimeout(() => {
    child.kill('SIGKILL');
  }, Number(process.env.DOWNLOAD_TIMEOUT || 5 * 60 * 1000));

  // Si le client se déconnecte, on tue le process pour ne pas gaspiller de ressources.
  req.on('close', () => {
    if (!child.killed) child.kill('SIGKILL');
  });

  child.on('error', (err) => {
    clearTimeout(killTimer);
    // eslint-disable-next-line no-console
    console.error('[download] Erreur process :', err.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'ERREUR_TELECHARGEMENT',
        message: 'Le téléchargement a échoué. Réessayez plus tard.',
      });
    } else {
      res.end();
    }
  });

  child.on('close', (code) => {
    clearTimeout(killTimer);
    if (code !== 0 && !res.headersSent) {
      const lower = stderrTail.toLowerCase();
      if (lower.includes('private') || lower.includes('login')) {
        return res.status(403).json({
          error: 'VIDEO_PRIVEE',
          message: 'Cette vidéo est privée. Impossible de la télécharger.',
        });
      }
      return res.status(500).json({
        error: 'ERREUR_TELECHARGEMENT',
        message: 'Le téléchargement a échoué. Réessayez plus tard.',
      });
    }
    // Si les en-têtes sont déjà partis, on ferme simplement la réponse.
    if (!res.writableEnded) res.end();
    return undefined;
  });

  return undefined;
}

router.post('/', downloadLimiter, validateUrl, handleDownload);

// Version GET : on mappe la query vers req.body pour réutiliser validateUrl.
router.get(
  '/',
  downloadLimiter,
  (req, _res, next) => {
    req.body = { url: req.query.url };
    next();
  },
  validateUrl,
  handleDownload
);

module.exports = router;
