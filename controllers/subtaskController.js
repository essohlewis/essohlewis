const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');

// Vérifie que la tâche parente appartient bien à l'utilisateur courant.
async function assertTaskOwned(taskId, userId) {
  const [rows] = await pool.query(
    'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
    [taskId, userId]
  );
  if (rows.length === 0) throw new AppError('Tâche introuvable.', 404);
}

// GET /api/tasks/:taskId/subtasks
const listSubtasks = asyncHandler(async (req, res) => {
  await assertTaskOwned(req.params.taskId, req.userId);
  const [rows] = await pool.query(
    'SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC, id ASC',
    [req.params.taskId]
  );
  res.json(rows);
});

// POST /api/tasks/:taskId/subtasks
const createSubtask = asyncHandler(async (req, res) => {
  await assertTaskOwned(req.params.taskId, req.userId);
  const { title } = req.body;

  // Nouvelle sous-tâche placée en fin de liste (position = max + 1).
  const [[{ nextPos }]] = await pool.query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM subtasks WHERE task_id = ?',
    [req.params.taskId]
  );

  const [result] = await pool.query(
    'INSERT INTO subtasks (task_id, title, position) VALUES (?, ?, ?)',
    [req.params.taskId, title, nextPos]
  );

  const [rows] = await pool.query('SELECT * FROM subtasks WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

// PATCH /api/tasks/:taskId/subtasks/:subId - modifie le titre et/ou l'état "fait".
const updateSubtask = asyncHandler(async (req, res) => {
  // Un seul JOIN garantit à la fois que la sous-tâche existe, qu'elle appartient
  // à la bonne tâche, et que cette tâche appartient à l'utilisateur.
  const [existing] = await pool.query(
    `SELECT s.* FROM subtasks s
       JOIN tasks t ON t.id = s.task_id
      WHERE s.id = ? AND s.task_id = ? AND t.user_id = ?`,
    [req.params.subId, req.params.taskId, req.userId]
  );
  if (existing.length === 0) throw new AppError('Sous-tâche introuvable.', 404);

  const current = existing[0];
  const title = req.body.title ?? current.title;
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : current.done;

  await pool.query(
    'UPDATE subtasks SET title = ?, done = ? WHERE id = ?',
    [title, done, req.params.subId]
  );

  const [rows] = await pool.query('SELECT * FROM subtasks WHERE id = ?', [req.params.subId]);
  res.json(rows[0]);
});

// DELETE /api/tasks/:taskId/subtasks/:subId
const deleteSubtask = asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    `DELETE s FROM subtasks s
       JOIN tasks t ON t.id = s.task_id
      WHERE s.id = ? AND s.task_id = ? AND t.user_id = ?`,
    [req.params.subId, req.params.taskId, req.userId]
  );
  if (result.affectedRows === 0) throw new AppError('Sous-tâche introuvable.', 404);
  res.json({ message: 'Sous-tâche supprimée.' });
});

module.exports = { listSubtasks, createSubtask, updateSubtask, deleteSubtask };
