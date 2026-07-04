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
const { upload, handleUploadError } = require('../middleware/upload');
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

/**
 * @swagger
 * /api/tasks/stats:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Obtenir les statistiques des tâches
 *     description: Retourne le nombre de tâches par statut, taux de complétion, et tâches en retard (avec cache 1h)
 *     parameters:
 *       - name: workspaceId
 *         in: query
 *         schema:
 *           type: integer
 *         description: ID du workspace (optionnel)
 *     responses:
 *       200:
 *         description: Statistiques récupérées
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Stats'
 */
router.get('/stats', cacheMiddleware(3600), getStats);

/**
 * @swagger
 * /api/tasks/reminders:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Obtenir les rappels d'échéance
 *     description: Retourne les tâches en retard et celles dont l'échéance approche
 *     parameters:
 *       - name: days
 *         in: query
 *         schema:
 *           type: integer
 *           default: 3
 *         description: Nombre de jours à l'avance pour les rappels
 *     responses:
 *       200:
 *         description: Rappels récupérés
 */
router.get('/reminders', cacheMiddleware(600), getReminders);

/**
 * @swagger
 * /api/tasks/tags:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Obtenir la liste des tags uniques
 *     description: Retourne tous les tags avec leur compteur de tâches
 *     responses:
 *       200:
 *         description: Tags récupérés
 */
router.get('/tags', cacheMiddleware(1800), getTags);

/**
 * @swagger
 * /api/tasks/shared:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Obtenir les tâches partagées avec moi
 *     description: Retourne les tâches que d'autres utilisateurs ont partagées avec moi
 *     responses:
 *       200:
 *         description: Tâches partagées récupérées
 */
router.get('/shared', cacheMiddleware(300), listSharedWithMe);

/**
 * @swagger
 * /api/tasks/export:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Exporter toutes les tâches
 *     description: Exporte toutes les tâches en JSON ou CSV
 *     parameters:
 *       - name: format
 *         in: query
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *     responses:
 *       200:
 *         description: Tâches exportées
 */
router.get('/export', exportTasks);

/**
 * @swagger
 * /api/tasks/import:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Importer des tâches
 *     description: Importe un fichier JSON avec des tâches
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tasks:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Tâches importées avec succès
 */
router.post('/import', importRules, importTasks);

/**
 * @swagger
 * /api/tasks/bulk:
 *   patch:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Action groupée sur plusieurs tâches
 *     description: Modifie ou supprime plusieurs tâches en une seule requête
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               action:
 *                 type: string
 *                 enum: [status, priority, delete]
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Opération effectuée
 */
router.patch('/bulk', bulkRules, bulkUpdate);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Lister toutes les tâches
 *     description: Retourne la liste de toutes les tâches avec filtres, tri et pagination
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [a_faire, en_cours, terminee]
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *           enum: [basse, moyenne, haute]
 *       - name: tag
 *         in: query
 *         schema:
 *           type: string
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           enum: [recent, ancien, echeance, priorite]
 *           default: recent
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Tâches récupérées
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 */
router.get('/', taskQueryRules, cacheMiddleware(300), getTasks);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Obtenir une tâche spécifique
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tâche récupérée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Tâche non trouvée
 */
router.get('/:id', cacheMiddleware(600), getTaskById);

/**
 * @swagger
 * /api/tasks/{id}/history:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Obtenir l'historique d'une tâche
 *     description: Retourne tous les changements apportés à une tâche
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historique récupéré
 */
router.get('/:id/history', cacheMiddleware(1800), getTaskHistory);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Créer une nouvelle tâche
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [a_faire, en_cours, terminee]
 *                 default: a_faire
 *               priority:
 *                 type: string
 *                 enum: [basse, moyenne, haute]
 *                 default: moyenne
 *               tag:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Tâche créée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 */
router.post('/', taskRules, createTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Modifier une tâche
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Tâche modifiée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 */
router.put('/:id', taskUpdateRules, updateTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Tâches
 *     summary: Supprimer une tâche
 *     description: Archive la tâche (soft delete)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tâche supprimée
 */
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
router.post('/:taskId/attachments', upload.single('file'), handleUploadError, uploadAttachment);
router.get('/:taskId/attachments/:id/download', downloadAttachment);
router.delete('/:taskId/attachments/:id', deleteAttachment);

module.exports = router;
