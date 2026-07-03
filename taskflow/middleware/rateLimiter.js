const rateLimit = require('express-rate-limit');

// Limite les tentatives de connexion/inscription : 20 essais / 15 min / IP.
// Suffisant pour un usage normal, mais ralentit fortement une attaque par force brute.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Trop de tentatives. Réessaie dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Limite générale, plus souple, pour le reste de l'API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { message: 'Trop de requêtes. Réessaie dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, apiLimiter };
