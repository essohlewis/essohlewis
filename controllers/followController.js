const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');

async function assertUserExists(id) {
  const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
  if (rows.length === 0) throw new AppError('Utilisateur introuvable.', 404);
}

// POST /api/users/:id/follow
const followUser = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.userId) throw new AppError('Tu ne peux pas te suivre toi-même.', 400);
  await assertUserExists(targetId);

  // INSERT IGNORE : suivre deux fois est sans effet.
  await pool.query(
    'INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)',
    [req.userId, targetId]
  );
  res.status(201).json({ following: true });
});

// DELETE /api/users/:id/follow
const unfollowUser = asyncHandler(async (req, res) => {
  await pool.query(
    'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
    [req.userId, Number(req.params.id)]
  );
  res.json({ following: false });
});

// GET /api/users/:id/followers
const listFollowers = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.bio, (u.avatar IS NOT NULL) AS has_avatar
       FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ ...r, has_avatar: !!r.has_avatar })));
});

// GET /api/users/:id/following
const listFollowing = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.bio, (u.avatar IS NOT NULL) AS has_avatar
       FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ ...r, has_avatar: !!r.has_avatar })));
});

// GET /api/users/feed - activités des personnes que je suis (et les miennes).
const getFeed = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.type, a.task_id, a.task_title, a.created_at,
            u.id AS user_id, u.name AS user_name, (u.avatar IS NOT NULL) AS has_avatar
       FROM activities a
       JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
         OR a.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 50`,
    [req.userId, req.userId]
  );
  res.json(rows.map((r) => ({ ...r, has_avatar: !!r.has_avatar })));
});

module.exports = { followUser, unfollowUser, listFollowers, listFollowing, getFeed };
