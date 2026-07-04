const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const { UPLOAD_DIR } = require('../middleware/upload');
const { assertTaskAccessible, assertTaskWritable } = require('../utils/taskAccess');

async function getAttachment(attachmentId, taskId) {
  const [rows] = await pool.query(
    'SELECT * FROM attachments WHERE id = ? AND task_id = ?',
    [attachmentId, taskId]
  );
  return rows[0] || null;
}

// GET /api/tasks/:taskId/attachments
const listAttachments = asyncHandler(async (req, res) => {
  await assertTaskAccessible(req.params.taskId, req.userId);
  const [rows] = await pool.query(
    'SELECT id, task_id, original_name, mime, size, created_at FROM attachments WHERE task_id = ? ORDER BY id ASC',
    [req.params.taskId]
  );
  res.json(rows);
});

// POST /api/tasks/:taskId/attachments (multipart, field "file")
const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Aucun fichier recu.', 400);

  try {
    await assertTaskWritable(req.params.taskId, req.userId);
  } catch (err) {
    fs.promises.unlink(req.file.path).catch(() => {});
    throw err;
  }

  const [result] = await pool.query(
    'INSERT INTO attachments (task_id, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?)',
    [req.params.taskId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]
  );

  const [rows] = await pool.query(
    'SELECT id, task_id, original_name, mime, size, created_at FROM attachments WHERE id = ?',
    [result.insertId]
  );
  res.status(201).json(rows[0]);
});

// GET /api/tasks/:taskId/attachments/:id/download
const downloadAttachment = asyncHandler(async (req, res) => {
  await assertTaskAccessible(req.params.taskId, req.userId);
  const attachment = await getAttachment(req.params.id, req.params.taskId);
  if (!attachment) throw new AppError('Piece jointe introuvable.', 404);

  const filePath = path.join(UPLOAD_DIR, attachment.filename);
  if (!fs.existsSync(filePath)) throw new AppError('Fichier introuvable sur le serveur.', 404);

  res.download(filePath, attachment.original_name);
});

// DELETE /api/tasks/:taskId/attachments/:id
const deleteAttachment = asyncHandler(async (req, res) => {
  await assertTaskWritable(req.params.taskId, req.userId);
  const attachment = await getAttachment(req.params.id, req.params.taskId);
  if (!attachment) throw new AppError('Piece jointe introuvable.', 404);

  await pool.query('DELETE FROM attachments WHERE id = ?', [attachment.id]);
  fs.promises.unlink(path.join(UPLOAD_DIR, attachment.filename)).catch(() => {});

  res.json({ message: 'Piece jointe supprimee.' });
});

module.exports = { listAttachments, uploadAttachment, downloadAttachment, deleteAttachment };
