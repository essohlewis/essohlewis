'use strict';

/**
 * server.js
 * -----------------------------------------------------------------------------
 * Point d'entrée du micro-back-end MediaGrab CI.
 *
 * Rôle unique : exposer /api/info et /api/download, et servir le front-end
 * statique (dossier ../public). Aucune base de données, aucun stockage.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const infoRoute = require('./routes/info');
const downloadRoute = require('./routes/download');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// --- Sécurité HTTP ---------------------------------------------------------
app.use(
  helmet({
    // CSP adaptée au front : polices Google, images distantes (miniatures).
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS : par défaut, on autorise l'origine configurée (ou tout en dev).
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

app.use(compression());

// Corps JSON borné (les URL sont courtes, pas besoin de gros payloads).
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// --- API -------------------------------------------------------------------
app.use('/api/info', infoRoute);
app.use('/api/download', downloadRoute);

// Endpoint de santé (monitoring / CI).
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mediagrab-ci', time: new Date().toISOString() });
});

// --- Front-end statique ----------------------------------------------------
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  })
);

// Fallback : sert index.html pour la racine.
app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Gestion des erreurs ---------------------------------------------------
// 404 pour les routes API inconnues.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NON_TROUVE', message: 'Ressource introuvable.' });
});

// Handler d'erreur global.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('[server] Erreur non gérée :', err && err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'ERREUR_SERVEUR', message: 'Erreur interne du serveur.' });
});

// On n'écoute pas si le module est importé (utile pour les tests).
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`\n🎬  MediaGrab CI — serveur démarré sur http://localhost:${PORT}\n`);
  });
}

module.exports = app;
