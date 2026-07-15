'use strict';

/**
 * rateLimiter.js
 * -----------------------------------------------------------------------------
 * Limiteurs de débit basés sur express-rate-limit.
 *
 * Deux limiteurs distincts :
 *   - infoLimiter     : pour /api/info (analyse) — plus permissif.
 *   - downloadLimiter : pour /api/download — plus strict (coûteux en CPU/réseau).
 */

const rateLimit = require('express-rate-limit');

const WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60 * 1000); // 1 minute

const infoLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: Number(process.env.RATE_INFO_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TROP_DE_REQUETES',
    message: "Trop d'analyses en peu de temps. Réessayez dans un instant.",
  },
});

const downloadLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: Number(process.env.RATE_DOWNLOAD_MAX || 8),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TROP_DE_REQUETES',
    message: 'Trop de téléchargements en peu de temps. Réessayez dans un instant.',
  },
});

module.exports = { infoLimiter, downloadLimiter };
