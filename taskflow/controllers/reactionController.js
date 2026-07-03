const pool = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { assertTaskAccessible } = require('../utils/taskAccess');

// Renvoie les compteurs par emoji + les emojis avec lesquels l'utilisateur a réagi.
async function reactionSummary(taskId, userId) {
  const [counts] = await pool.query(
    'SELECT emoji, COUNT(*) AS count FROM reactions WHERE task_id = ? GROUP BY emoji',
    [taskId]
  );
  const [mine] = await pool.query(
    'SELECT emoji FROM reactions WHERE task_id = ? AND user_id = ?',
    [taskId, userId]
  );
  return {
    counts: counts.map((c) => ({ emoji: c.emoji, count: Number(c.count) })),
    mine: mine.map((m) => m.emoji)
  };
}

// GET /api/tasks/:taskId/reactions
const listReactions = asyncHandler(async (req, res) => {
  await assertTaskAccessible(req.params.taskId, req.userId);
  res.json(await reactionSummary(req.params.taskId, req.userId));
});

// POST /api/tasks/:taskId/reactions - bascule (toggle) une réaction emoji.
const toggleReaction = asyncHandler(async (req, res) => {
  await assertTaskAccessible(req.params.taskId, req.userId);
  const emoji = req.body.emoji.trim();

  const [existing] = await pool.query(
    'SELECT id FROM reactions WHERE task_id = ? AND user_id = ? AND emoji = ?',
    [req.params.taskId, req.userId, emoji]
  );

  if (existing.length > 0) {
    await pool.query('DELETE FROM reactions WHERE id = ?', [existing[0].id]);
  } else {
    await pool.query(
      'INSERT INTO reactions (task_id, user_id, emoji) VALUES (?, ?, ?)',
      [req.params.taskId, req.userId, emoji]
    );
  }

  res.json(await reactionSummary(req.params.taskId, req.userId));
});

module.exports = { listReactions, toggleReaction };
