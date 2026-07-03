const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const {
  taskRules,
  taskUpdateRules,
  taskQueryRules,
  bulkRules,
  subtaskRules,
  subtaskUpdateRules
} = require('../middleware/validators');
const {
  getTasks,
  getStats,
  getTaskById,
  createTask,
  updateTask,
  bulkUpdate,
  deleteTask
} = require('../controllers/taskController');
const {
  listSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask
} = require('../controllers/subtaskController');

// Toutes les routes ci-dessous nécessitent d'être connecté
router.use(requireAuth);

// /stats et /bulk doivent être déclarées avant /:id pour ne pas être
// interprétées comme un identifiant de tâche.
router.get('/stats', getStats);
router.patch('/bulk', bulkRules, bulkUpdate);

router.get('/', taskQueryRules, getTasks);
router.get('/:id', getTaskById);
router.post('/', taskRules, createTask);
router.put('/:id', taskUpdateRules, updateTask);
router.delete('/:id', deleteTask);

// Sous-tâches (checklist) rattachées à une tâche.
router.get('/:taskId/subtasks', listSubtasks);
router.post('/:taskId/subtasks', subtaskRules, createSubtask);
router.patch('/:taskId/subtasks/:subId', subtaskUpdateRules, updateSubtask);
router.delete('/:taskId/subtasks/:subId', deleteSubtask);

module.exports = router;
