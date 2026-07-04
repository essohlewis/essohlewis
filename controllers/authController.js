const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');

// Durée de vie du token d'accès (court par défaut : sécurité renforcée, car il
// n'est plus valable 7 jours). Le refresh token prend le relais de façon
// transparente côté client.
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;

function signAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

// Le refresh token est une valeur aléatoire opaque (pas un JWT). On stocke
// uniquement son hash SHA-256 en base ; le jeton en clair n'existe que côté client.
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, hashToken(raw), expiresAt]
  );
  return raw;
}

async function buildSession(user) {
  const token = signAccessToken(user.id);
  const refreshToken = await issueRefreshToken(user.id);
  return {
    token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role || 'user' }
  };
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    logger.warn('Registration attempt with existing email: %s', email);
    throw new AppError('Cet email est déjà utilisé.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const [result] = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, hashedPassword, 'user']
  );

  const session = await buildSession({ id: result.insertId, name, email, role: 'user' });
  logger.info('New user registered: %s (id: %d)', email, result.insertId);
  res.status(201).json({ message: 'Compte créé avec succès.', ...session });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];

  // Message volontairement identique dans les deux cas (email inconnu / mot de passe faux)
  // pour ne pas révéler si un email existe dans la base.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    logger.warn('Failed login attempt for email: %s', email);
    throw new AppError('Email ou mot de passe incorrect.', 401);
  }

  const session = await buildSession(user);
  logger.info('User logged in: %s (id: %d)', email, user.id);
  res.json({ message: 'Connexion réussie.', ...session });
});

// POST /api/auth/refresh - échange un refresh token valide contre un nouveau
// token d'accès, et effectue une ROTATION (l'ancien refresh token est invalidé,
// un nouveau est émis). Un refresh token ne sert donc qu'une seule fois.
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const tokenHash = hashToken(refreshToken);

  const [rows] = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = ?',
    [tokenHash]
  );
  const record = rows[0];

  if (!record || new Date(record.expires_at) < new Date()) {
    // Jeton inconnu, déjà utilisé (rotation) ou expiré : on nettoie si besoin.
    if (record) {
      await pool.query('DELETE FROM refresh_tokens WHERE id = ?', [record.id]);
      logger.warn(`Expired or already used refresh token deleted for user ${record.user_id}`);
    }
    throw new AppError('Session expirée, reconnecte-toi.', 401);
  }

  // Verify user still exists and is active
  const [userRows] = await pool.query(
    'SELECT id FROM users WHERE id = ?',
    [record.user_id]
  );
  if (userRows.length === 0) {
    await pool.query('DELETE FROM refresh_tokens WHERE id = ?', [record.id]);
    logger.warn(`Refresh token revoked for deleted user ${record.user_id}`);
    throw new AppError('Session expirée, reconnecte-toi.', 401);
  }

  // Rotation : on supprime l'ancien jeton et on en émet un nouveau.
  await pool.query('DELETE FROM refresh_tokens WHERE id = ?', [record.id]);

  const token = signAccessToken(record.user_id);
  const newRefreshToken = await issueRefreshToken(record.user_id);

  logger.info(`Token refreshed for user ${record.user_id}`);
  res.json({ token, refreshToken: newRefreshToken });
});

// POST /api/auth/logout - révoque le refresh token fourni (déconnexion propre).
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(refreshToken)]);
    logger.info('User logged out and refresh token revoked');
  }
  res.json({ message: 'Déconnexion réussie.' });
});

module.exports = { register, login, refresh, logout };
