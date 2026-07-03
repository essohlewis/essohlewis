const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Sécurité : en-têtes HTTP protecteurs (CSP désactivée ici pour ne pas
// bloquer les polices Google Fonts et le JS inline du frontend statique).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// Compression gzip des réponses : réduit fortement la taille des payloads JSON
// et des fichiers statiques envoyés au navigateur (moins de bande passante,
// chargement plus rapide), pour un coût CPU négligeable.
app.use(compression());

app.use(express.json({ limit: '100kb' }));

// Limite générale de requêtes par IP, pour absorber les abus
app.use('/api', apiLimiter);

// Sert les fichiers du frontend (HTML/CSS/JS) depuis /public
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Route de vérification rapide
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 pour toute route API inconnue
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route inconnue.' });
});

// Doit être déclaré en dernier : capte toutes les erreurs transmises par next(err)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// N'écoute pas automatiquement pendant les tests (supertest gère ça lui-même)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
  });
}

module.exports = app;
