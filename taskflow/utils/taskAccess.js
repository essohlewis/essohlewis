const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

// Read/social access: owner, explicit share recipient, or workspace member.
async function assertTaskAccessible(taskId, userId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.title, t.user_id, t.workspace_id
       FROM tasks t
       LEFT JOIN workspace_members wm
              ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
      WHERE t.id = ?
        AND (t.user_id = ?
             OR wm.user_id IS NOT NULL
             OR EXISTS (SELECT 1 FROM task_shares s
                         WHERE s.task_id = t.id AND s.user_id = ?))`,
    [userId, taskId, userId, userId]
  );
  if (rows.length === 0) throw new AppError('Tache introuvable.', 404);
  return rows[0];
}

// Write access: owner, or workspace member. Explicit task shares stay read-only.
async function assertTaskWritable(taskId, userId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.title, t.user_id, t.workspace_id,
            (t.user_id = ? OR wm.user_id IS NOT NULL) AS can_write,
            (t.user_id = ? OR wm.user_id IS NOT NULL OR s.user_id IS NOT NULL) AS can_read
       FROM tasks t
       LEFT JOIN workspace_members wm
              ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
       LEFT JOIN task_shares s
              ON s.task_id = t.id AND s.user_id = ?
      WHERE t.id = ?`,
    [userId, userId, userId, userId, taskId]
  );

  if (rows.length === 0 || !rows[0].can_read) {
    throw new AppError('Tache introuvable.', 404);
  }
  if (!rows[0].can_write) {
    throw new AppError('Action non autorisee sur une tache partagee en lecture seule.', 403);
  }
  return rows[0];
}

module.exports = { assertTaskAccessible, assertTaskWritable };
