const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const requireAuth = require('../middleware/auth');
const { checkTenantMembership } = require('../middleware/tenant');

// Toutes les routes IA requièrent d'être authentifié et membre du tenant si spécifié
router.use(requireAuth);
router.use(checkTenantMembership);

router.post('/chat', aiController.chat);
router.post('/generate-tasks', aiController.generateTasks);

module.exports = router;
