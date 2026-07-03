const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const { UPLOAD_DIR } = require('../middleware/upload');

// Agrège les statistiques publiques d'un profil (tâches terminées, abonnés…).
async function profilePayload(userId, viewerId) {
  const [users] = await pool.query(
    'SELECT id, name, email, bio, avatar FROM users WHERE id = ?',
    [userId]
  );
  const user = users[0];
  if (!user) throw new AppError('Utilisateur introuvable.', 404);

  const [[stats]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'terminee') AS completed,
       (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
       (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
    [userId, userId, userId]
  );

  let isFollowing = false;
  if (viewerId && viewerId !== userId) {
    const [f] = await pool.query(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      [viewerId, userId]
    );
    isFollowing = f.length > 0;
  }

  return {
    id: user.id,
    name: user.name,
    // L'email n'est exposé que sur son propre profil.
    email: viewerId === userId ? user.email : undefined,
    bio: user.bio,
    has_avatar: !!user.avatar,
    completed: Number(stats.completed),
    followers: Number(stats.followers),
    following: Number(stats.following),
    is_following: isFollowing,
    is_me: viewerId === userId
  };
}

// GET /api/users/me
const getMe = asyncHandler(async (req, res) => {
  res.json(await profilePayload(req.userId, req.userId));
});

// PUT /api/users/me - met à jour le nom et/ou la bio.
const updateMe = asyncHandler(async (req, res) => {
  const { name, bio } = req.body;
  const [[current]] = await pool.query('SELECT name, bio FROM users WHERE id = ?', [req.userId]);

  await pool.query(
    'UPDATE users SET name = ?, bio = ? WHERE id = ?',
    [
      name !== undefined ? name : current.name,
      bio !== undefined ? bio : current.bio,
      req.userId
    ]
  );
  res.json(await profilePayload(req.userId, req.userId));
});

// POST /api/users/me/avatar (multipart, champ "avatar")
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Aucun fichier reçu.', 400);

  const [[current]] = await pool.query('SELECT avatar FROM users WHERE id = ?', [req.userId]);
  await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [req.file.filename, req.userId]);

  // Supprime l'ancien avatar du disque (best effort).
  if (current && current.avatar) {
    fs.promises.unlink(path.join(UPLOAD_DIR, current.avatar)).catch(() => {});
  }
  res.status(201).json({ has_avatar: true });
});

// GET /api/users/:id - profil public d'un utilisateur.
const getProfile = asyncHandler(async (req, res) => {
  res.json(await profilePayload(Number(req.params.id), req.userId));
});

// GET /api/users/:id/avatar - image d'avatar (ou 404).
const getAvatar = asyncHandler(async (req, res) => {
  const [[user]] = await pool.query('SELECT avatar FROM users WHERE id = ?', [req.params.id]);
  if (!user || !user.avatar) throw new AppError('Aucun avatar.', 404);

  const filePath = path.join(UPLOAD_DIR, user.avatar);
  if (!fs.existsSync(filePath)) throw new AppError('Aucun avatar.', 404);
  res.sendFile(filePath);
});

module.exports = { getMe, updateMe, uploadAvatar, getProfile, getAvatar, profilePayload };
