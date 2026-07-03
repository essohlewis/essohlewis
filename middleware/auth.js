const jwt = require('jsonwebtoken');

// Vérifie le token JWT envoyé dans le header "Authorization: Bearer <token>"
// ou dans le paramètre de requête "token" (pour EventSource).
function requireAuth(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // Rendu disponible pour les routes suivantes
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
}

module.exports = requireAuth;
