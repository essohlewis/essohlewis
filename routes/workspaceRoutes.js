const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const requireAuth = require('../middleware/auth');

// Routes pour la gestion des espaces de travail
router.post('/', requireAuth, workspaceController.createWorkspace);
router.get('/', requireAuth, workspaceController.getWorkspaces);
router.delete('/:id', requireAuth, workspaceController.deleteWorkspace);

// Routes pour la gestion des membres de l'équipe
router.get('/:id/members', requireAuth, workspaceController.getWorkspaceMembers);
router.post('/:id/members', requireAuth, workspaceController.addWorkspaceMember);
router.delete('/:id/members/:userId', requireAuth, workspaceController.removeWorkspaceMember);

module.exports = router;
