const pool = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { assertTaskAccessible } = require('../utils/taskAccess');
const { createAndSendNotification } = require('./notificationController');

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
  const task = await assertTaskAccessible(req.params.taskId, req.userId);
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

    // Notifier le propriétaire s'il n'est pas l'auteur de la réaction
    if (task.user_id !== req.userId) {
      const [users] = await pool.query('SELECT name FROM users WHERE id = ?', [req.userId]);
      const userName = users[0] ? users[0].name : 'Un utilisateur';
      await createAndSendNotification(
        task.user_id,
        'reaction',
        `${userName} a réagi avec ${emoji} à ta tâche "${task.title}".`
      );
    }
  }

  res.json(await reactionSummary(req.params.taskId, req.userId));
});

module.exports = { listReactions, toggleReaction };
