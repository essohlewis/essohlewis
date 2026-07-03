const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const { createAndSendNotification } = require('./notificationController');

async function assertTaskOwned(taskId, userId) {
  const [rows] = await pool.query(
    'SELECT id, title FROM tasks WHERE id = ? AND user_id = ?',
    [taskId, userId]
  );
  if (rows.length === 0) throw new AppError('Tâche introuvable.', 404);
  return rows[0];
}

// GET /api/tasks/shared - tâches qu'on m'a partagées (lecture seule).
const listSharedWithMe = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.title, t.description, t.status, t.priority, t.tag, t.due_date,
            u.name AS owner_name, u.email AS owner_email
       FROM task_shares s
       JOIN tasks t ON t.id = s.task_id
       JOIN users u ON u.id = t.user_id
      WHERE s.user_id = ?
      ORDER BY t.created_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

// GET /api/tasks/:taskId/shares - liste des destinataires (propriétaire seulement).
const listShares = asyncHandler(async (req, res) => {
  await assertTaskOwned(req.params.taskId, req.userId);
  const [rows] = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email
       FROM task_shares s
       JOIN users u ON u.id = s.user_id
      WHERE s.task_id = ?
      ORDER BY u.name ASC`,
    [req.params.taskId]
  );
  res.json(rows);
});

// POST /api/tasks/:taskId/shares - partage la tâche avec un utilisateur (par email).
const shareTask = asyncHandler(async (req, res) => {
  const task = await assertTaskOwned(req.params.taskId, req.userId);
  const { email } = req.body;

  const [users] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
  const recipient = users[0];
  if (!recipient) throw new AppError('Aucun utilisateur avec cet email.', 404);
  if (recipient.id === req.userId) throw new AppError('Tu ne peux pas te partager ta propre tâche.', 400);

  const [resShare] = await pool.query(
    'INSERT IGNORE INTO task_shares (task_id, user_id) VALUES (?, ?)',
    [req.params.taskId, recipient.id]
  );

  if (resShare.affectedRows > 0) {
    const [owner] = await pool.query('SELECT name FROM users WHERE id = ?', [req.userId]);
    const ownerName = owner[0] ? owner[0].name : 'Un utilisateur';
    await createAndSendNotification(
      recipient.id,
      'share',
      `${ownerName} a partagé la tâche "${task.title}" avec toi.`
    );
  }

  res.status(201).json({ user_id: recipient.id, name: recipient.name, email: recipient.email });
});

// DELETE /api/tasks/:taskId/shares/:userId - révoque un partage (propriétaire seulement).
const unshareTask = asyncHandler(async (req, res) => {
  await assertTaskOwned(req.params.taskId, req.userId);
  await pool.query(
    'DELETE FROM task_shares WHERE task_id = ? AND user_id = ?',
    [req.params.taskId, req.params.userId]
  );
  res.json({ message: 'Partage révoqué.' });
});

module.exports = { listSharedWithMe, listShares, shareTask, unshareTask };
