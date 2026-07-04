const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const { assertTaskAccessible, assertTaskWritable } = require('../utils/taskAccess');

// GET /api/tasks/:taskId/subtasks
const listSubtasks = asyncHandler(async (req, res) => {
  await assertTaskAccessible(req.params.taskId, req.userId);
  const [rows] = await pool.query(
    'SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC, id ASC',
    [req.params.taskId]
  );
  res.json(rows);
});

// POST /api/tasks/:taskId/subtasks
const createSubtask = asyncHandler(async (req, res) => {
  await assertTaskWritable(req.params.taskId, req.userId);
  const { title } = req.body;

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

// PATCH /api/tasks/:taskId/subtasks/:subId
const updateSubtask = asyncHandler(async (req, res) => {
  await assertTaskWritable(req.params.taskId, req.userId);
  const [existing] = await pool.query(
    'SELECT * FROM subtasks WHERE id = ? AND task_id = ?',
    [req.params.subId, req.params.taskId]
  );
  if (existing.length === 0) throw new AppError('Sous-tache introuvable.', 404);

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
  await assertTaskWritable(req.params.taskId, req.userId);
  const [result] = await pool.query(
    'DELETE FROM subtasks WHERE id = ? AND task_id = ?',
    [req.params.subId, req.params.taskId]
  );
  if (result.affectedRows === 0) throw new AppError('Sous-tache introuvable.', 404);
  res.json({ message: 'Sous-tache supprimee.' });
});

module.exports = { listSubtasks, createSubtask, updateSubtask, deleteSubtask };
