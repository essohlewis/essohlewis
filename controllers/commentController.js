const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const { assertTaskAccessible } = require('../utils/taskAccess');
const { logActivity } = require('../utils/activity');
const { createAndSendNotification } = require('./notificationController');

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

  // Notification SSE et DB
  const commenterName = comment.user_name || 'Un utilisateur';
  
  // 1. Notifier le propriétaire s'il n'est pas l'auteur
  if (task.user_id !== req.userId) {
    await createAndSendNotification(
      task.user_id,
      'comment',
      `${commenterName} a commenté la tâche "${task.title}".`
    );
  }

  // 2. Notifier les personnes mentionnées
  const mentions = comment.body.match(/@([a-zA-Z0-9_\-]+)/g);
  if (mentions) {
    const names = mentions.map(m => m.slice(1));
    for (const name of names) {
      const [users] = await pool.query(
        `SELECT u.id FROM users u 
         WHERE u.name = ? 
           AND (u.id = ? 
                OR EXISTS (SELECT 1 FROM task_shares s WHERE s.task_id = ? AND s.user_id = u.id))`,
        [name, task.user_id, task.id]
      );
      const mentionedUser = users[0];
      if (mentionedUser && mentionedUser.id !== req.userId && mentionedUser.id !== task.user_id) {
        await createAndSendNotification(
          mentionedUser.id,
          'comment',
          `${commenterName} t'a mentionné(e) dans un commentaire sur "${task.title}".`
        );
      }
    }
  }

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
