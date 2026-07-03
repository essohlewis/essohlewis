const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw new AppError('Cet email est déjà utilisé.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const [result] = await pool.query(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, hashedPassword]
  );

  const token = signToken(result.insertId);

  res.status(201).json({
    message: 'Compte créé avec succès.',
    token,
    user: { id: result.insertId, name, email }
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];

  // Message volontairement identique dans les deux cas (email inconnu / mot de passe faux)
  // pour ne pas révéler si un email existe dans la base.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Email ou mot de passe incorrect.', 401);
  }

  const token = signToken(user.id);

  res.json({
    message: 'Connexion réussie.',
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

module.exports = { register, login };
