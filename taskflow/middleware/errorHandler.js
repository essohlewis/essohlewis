// Erreur "métier" volontaire, avec un code HTTP explicite.
// Utile pour lever des erreurs propres depuis les contrôleurs :
// throw new AppError('Tâche introuvable.', 404);
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Doit être déclaré en dernier dans server.js (après toutes les routes) :
// Express reconnaît un middleware d'erreur à sa signature à 4 arguments.
function errorHandler(err, req, res, next) {
  // Erreurs de validation MySQL courantes, traduites en messages clairs
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Cette valeur existe déjà.' });
  }
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({ message: 'Base de données indisponible pour le moment.' });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Erreur interne du serveur.' : err.message;

  if (statusCode === 500) {
    console.error('❌ Erreur non gérée :', err);
  }

  res.status(statusCode).json({ message });
}

module.exports = { AppError, errorHandler };
