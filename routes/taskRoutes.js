const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const {
  taskRules,
  taskUpdateRules,
  taskQueryRules,
  bulkRules,
  importRules,
  shareRules,
  commentRules,
  reactionRules,
  subtaskRules,
  subtaskUpdateRules
} = require('../middleware/validators');
const {
  getTasks,
  getStats,
  getReminders,
  getTags,
  getTaskById,
  createTask,
  updateTask,
  bulkUpdate,
  deleteTask,
  exportTasks,
  importTasks,
  getTaskHistory
} = require('../controllers/taskController');
const {
  listSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask
} = require('../controllers/subtaskController');
const {
  listAttachments,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment
} = require('../controllers/attachmentController');
const { upload } = require('../middleware/upload');
const {
  listSharedWithMe,
  listShares,
  shareTask,
  unshareTask
} = require('../controllers/shareController');
const {
  listComments,
  addComment,
  deleteComment
} = require('../controllers/commentController');
const { listReactions, toggleReaction } = require('../controllers/reactionController');

// Toutes les routes ci-dessous nécessitent d'être connecté
router.use(requireAuth);

// /stats et /bulk doivent être déclarées avant /:id pour ne pas être
// interprétées comme un identifiant de tâche.
router.get('/stats', cacheMiddleware(3600), getStats);  // Cache 1 heure
router.get('/reminders', cacheMiddleware(600), getReminders);  // Cache 10 min
router.get('/tags', cacheMiddleware(1800), getTags);  // Cache 30 min
router.get('/shared', cacheMiddleware(300), listSharedWithMe);  // Cache 5 min
router.get('/export', exportTasks);  // Pas de cache (data fraîche)
router.post('/import', importRules, importTasks);
router.patch('/bulk', bulkRules, bulkUpdate);

router.get('/', taskQueryRules, cacheMiddleware(300), getTasks);  // Cache 5 min
router.get('/:id', cacheMiddleware(600), getTaskById);  // Cache 10 min
router.get('/:id/history', cacheMiddleware(1800), getTaskHistory);  // Cache 30 min
router.post('/', taskRules, createTask);
router.put('/:id', taskUpdateRules, updateTask);
router.delete('/:id', deleteTask);

// Sous-tâches (checklist) rattachées à une tâche.
router.get('/:taskId/subtasks', listSubtasks);
router.post('/:taskId/subtasks', subtaskRules, createSubtask);
router.patch('/:taskId/subtasks/:subId', subtaskUpdateRules, updateSubtask);
router.delete('/:taskId/subtasks/:subId', deleteSubtask);

// Partage d'une tâche avec d'autres utilisateurs.
router.get('/:taskId/shares', listShares);
router.post('/:taskId/shares', shareRules, shareTask);
router.delete('/:taskId/shares/:userId', unshareTask);

// Commentaires (fil de discussion) rattachés à une tâche.
router.get('/:taskId/comments', cacheMiddleware(600), listComments);  // Cache 10 min
router.post('/:taskId/comments', commentRules, addComment);
router.delete('/:taskId/comments/:commentId', deleteComment);

// Réactions (emoji) sur une tâche.
router.get('/:taskId/reactions', cacheMiddleware(600), listReactions);  // Cache 10 min
router.post('/:taskId/reactions', reactionRules, toggleReaction);

// Pièces jointes rattachées à une tâche.
router.get('/:taskId/attachments', listAttachments);
router.post('/:taskId/attachments', upload.single('file'), uploadAttachment);
router.get('/:taskId/attachments/:id/download', downloadAttachment);
router.delete('/:taskId/attachments/:id', deleteAttachment);

module.exports = router;
