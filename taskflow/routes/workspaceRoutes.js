const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const requireAuth = require('../middleware/auth');
const { checkTenantMembership } = require('../middleware/tenant');

// Toutes les routes pour les espaces de travail requièrent d'être authentifié et membre du tenant si spécifié
router.use(requireAuth);
router.use(checkTenantMembership);

// Routes pour la gestion des espaces de travail
router.post('/', workspaceController.createWorkspace);
router.get('/', workspaceController.getWorkspaces);
router.delete('/:id', workspaceController.deleteWorkspace);

// Routes pour la gestion des membres de l'équipe
router.get('/:id/members', workspaceController.getWorkspaceMembers);
router.post('/:id/members', workspaceController.addWorkspaceMember);
router.delete('/:id/members/:userId', workspaceController.removeWorkspaceMember);

module.exports = router;
