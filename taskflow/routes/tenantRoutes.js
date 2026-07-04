const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const requireAuth = require('../middleware/auth');

// Toutes les routes pour les organisations requièrent d'être authentifié
router.use(requireAuth);

router.post('/', tenantController.createTenant);
router.get('/me', tenantController.getTenants);
router.get('/:id/members', tenantController.getTenantMembers);
router.post('/:id/members', tenantController.addTenantMember);
router.delete('/:id/members/:userId', tenantController.removeTenantMember);

module.exports = router;
