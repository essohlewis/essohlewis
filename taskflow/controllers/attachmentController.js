const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const { UPLOAD_DIR } = require('../middleware/upload');

async function assertTaskOwned(taskId, userId) {
  const [rows] = await pool.query(
    'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
    [taskId, userId]
  );
  if (rows.length === 0) throw new AppError('Tâche introuvable.', 404);
}

// Récupère une pièce jointe en vérifiant qu'elle appartient bien à une tâche
// de l'utilisateur (JOIN sur tasks.user_id).
async function getOwnedAttachment(attachmentId, taskId, userId) {
  const [rows] = await pool.query(
    `SELECT a.* FROM attachments a
       JOIN tasks t ON t.id = a.task_id
      WHERE a.id = ? AND a.task_id = ? AND t.user_id = ?`,
    [attachmentId, taskId, userId]
  );
  return rows[0] || null;
}

// GET /api/tasks/:taskId/attachments
const listAttachments = asyncHandler(async (req, res) => {
  await assertTaskOwned(req.params.taskId, req.userId);
  const [rows] = await pool.query(
    'SELECT id, task_id, original_name, mime, size, created_at FROM attachments WHERE task_id = ? ORDER BY id ASC',
    [req.params.taskId]
  );
  res.json(rows);
});

// POST /api/tasks/:taskId/attachments (multipart, champ "file")
const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Aucun fichier reçu.', 400);

  // On vérifie l'appartenance APRÈS réception : si elle échoue, on supprime le
  // fichier temporaire pour ne pas laisser de fichier orphelin sur le disque.
  try {
    await assertTaskOwned(req.params.taskId, req.userId);
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
  const att = await getOwnedAttachment(req.params.id, req.params.taskId, req.userId);
  if (!att) throw new AppError('Pièce jointe introuvable.', 404);

  const filePath = path.join(UPLOAD_DIR, att.filename);
  if (!fs.existsSync(filePath)) throw new AppError('Fichier introuvable sur le serveur.', 404);

  res.download(filePath, att.original_name);
});

// DELETE /api/tasks/:taskId/attachments/:id
const deleteAttachment = asyncHandler(async (req, res) => {
  const att = await getOwnedAttachment(req.params.id, req.params.taskId, req.userId);
  if (!att) throw new AppError('Pièce jointe introuvable.', 404);

  await pool.query('DELETE FROM attachments WHERE id = ?', [att.id]);
  // Suppression du fichier physique (best effort).
  fs.promises.unlink(path.join(UPLOAD_DIR, att.filename)).catch(() => {});

  res.json({ message: 'Pièce jointe supprimée.' });
});

module.exports = { listAttachments, uploadAttachment, downloadAttachment, deleteAttachment };
