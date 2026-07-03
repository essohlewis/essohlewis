const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

// Accès en lecture/interaction sociale : le propriétaire OU un utilisateur avec
// qui la tâche a été partagée. Renvoie la tâche (id, title, user_id) ou lève 404.
async function assertTaskAccessible(taskId, userId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.title, t.user_id
       FROM tasks t
      WHERE t.id = ?
        AND (t.user_id = ?
             OR EXISTS (SELECT 1 FROM task_shares s
                         WHERE s.task_id = t.id AND s.user_id = ?))`,
    [taskId, userId, userId]
  );
  if (rows.length === 0) throw new AppError('Tâche introuvable.', 404);
  return rows[0];
}

module.exports = { assertTaskAccessible };
