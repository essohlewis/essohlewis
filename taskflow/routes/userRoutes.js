const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { checkTenantMembership } = require('../middleware/tenant');
const { profileRules } = require('../middleware/validators');
const { upload } = require('../middleware/upload');
const {
  getMe,
  updateMe,
  uploadAvatar,
  getProfile
} = require('../controllers/userController');
const {
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
  getFeed
} = require('../controllers/followController');

router.use(requireAuth);
router.use(checkTenantMembership);

// Profil courant
router.get('/me', getMe);
router.put('/me', profileRules, updateMe);
router.post('/me/avatar', upload.single('avatar'), uploadAvatar);

// Fil d'actualité (avant /:id pour ne pas être capté comme un id)
router.get('/feed', getFeed);

// Profil public (l'avatar est servi par une route publique déclarée dans server.js)
router.get('/:id', getProfile);

// Suivi
router.post('/:id/follow', followUser);
router.delete('/:id/follow', unfollowUser);
router.get('/:id/followers', listFollowers);
router.get('/:id/following', listFollowing);

module.exports = router;
