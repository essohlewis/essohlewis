const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { checkTenantMembership } = require('../middleware/tenant');
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
  getTaskHistory,
  getArchivedTasks,
  restoreTask,
  startTimer,
  stopTimer
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
router.use(checkTenantMembership);

// /stats et /bulk doivent être déclarées avant /:id pour ne pas être
// interprétées comme un identifiant de tâche.
router.get('/stats', getStats);
router.get('/reminders', getReminders);
router.get('/tags', getTags);
router.get('/shared', listSharedWithMe);
router.get('/export', exportTasks);
router.post('/import', importRules, importTasks);
router.patch('/bulk', bulkRules, bulkUpdate);

router.get('/archived/list', getArchivedTasks);
router.post('/:id/restore', restoreTask);

// Suivi du temps : démarrer / arrêter le minuteur d'une tâche.
router.post('/:id/timer/start', startTimer);
router.post('/:id/timer/stop', stopTimer);

router.get('/', taskQueryRules, getTasks);
router.get('/:id', getTaskById);
router.get('/:id/history', getTaskHistory);
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
router.get('/:taskId/comments', listComments);
router.post('/:taskId/comments', commentRules, addComment);
router.delete('/:taskId/comments/:commentId', deleteComment);

// Réactions (emoji) sur une tâche.
router.get('/:taskId/reactions', listReactions);
router.post('/:taskId/reactions', reactionRules, toggleReaction);

// Pièces jointes rattachées à une tâche.
router.get('/:taskId/attachments', listAttachments);
router.post('/:taskId/attachments', upload.single('file'), uploadAttachment);
router.get('/:taskId/attachments/:id/download', downloadAttachment);
router.delete('/:taskId/attachments/:id', deleteAttachment);

module.exports = router;
