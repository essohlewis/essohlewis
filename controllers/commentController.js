const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const { assertTaskAccessible } = require('../utils/taskAccess');
const { logActivity } = require('../utils/activity');

// GET /api/tasks/:taskId/comments
const listComments = asyncHandler(async (req, res) => {
  await assertTaskAccessible(req.params.taskId, req.userId);
  const [rows] = await pool.query(
    `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.name AS user_name,
            (u.avatar IS NOT NULL) AS has_avatar
       FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC, c.id ASC`,
    [req.params.taskId]
  );
  res.json(rows.map((r) => ({ ...r, has_avatar: !!r.has_avatar })));
});

// POST /api/tasks/:taskId/comments
const addComment = asyncHandler(async (req, res) => {
  const task = await assertTaskAccessible(req.params.taskId, req.userId);

  const [result] = await pool.query(
    'INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)',
    [req.params.taskId, req.userId, req.body.body.trim()]
  );

  logActivity(req.userId, 'commented', task.id, task.title);

  const [rows] = await pool.query(
    `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.name AS user_name,
            (u.avatar IS NOT NULL) AS has_avatar
       FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.id = ?`,
    [result.insertId]
  );
  const comment = rows[0];
  comment.has_avatar = !!comment.has_avatar;
  res.status(201).json(comment);
});

// DELETE /api/tasks/:taskId/comments/:commentId
// Autorisé à l'auteur du commentaire ou au propriétaire de la tâche.
const deleteComment = asyncHandler(async (req, res) => {
  const task = await assertTaskAccessible(req.params.taskId, req.userId);

  const [rows] = await pool.query(
    'SELECT * FROM comments WHERE id = ? AND task_id = ?',
    [req.params.commentId, req.params.taskId]
  );
  const comment = rows[0];
  if (!comment) throw new AppError('Commentaire introuvable.', 404);

  const isAuthor = comment.user_id === req.userId;
  const isTaskOwner = task.user_id === req.userId;
  if (!isAuthor && !isTaskOwner) throw new AppError('Action non autorisée.', 403);

  await pool.query('DELETE FROM comments WHERE id = ?', [comment.id]);
  res.json({ message: 'Commentaire supprimé.' });
});

module.exports = { listComments, addComment, deleteComment };
