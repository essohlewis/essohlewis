const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const {
  streamNotifications,
  getNotifications,
  markAsRead,
  markAllRead
} = require('../controllers/notificationController');

// Toutes les routes nécessitent une authentification
router.use(requireAuth);

router.get('/stream', streamNotifications);
router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.post('/mark-all-read', markAllRead);

module.exports = router;
