const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { checkTenantMembership } = require('../middleware/tenant');
const { listViews, createView, deleteView } = require('../controllers/savedViewController');

// Toutes les routes des vues enregistrées nécessitent d'être connecté.
router.use(requireAuth);
router.use(checkTenantMembership);

router.get('/', listViews);
router.post('/', createView);
router.delete('/:id', deleteView);

module.exports = router;
