const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
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

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Obtenir mon profil
 *     description: Retourne les informations du profil actuel (avec email visible)
 *     responses:
 *       200:
 *         description: Profil récupéré
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.get('/me', getMe);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Mettre à jour mon profil
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profil mis à jour
 */
router.put('/me', profileRules, updateMe);

/**
 * @swagger
 * /api/users/me/avatar:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Téléverser mon avatar
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar téléversé
 */
router.post('/me/avatar', upload.single('avatar'), uploadAvatar);

/**
 * @swagger
 * /api/users/feed:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Obtenir mon fil d'actualité
 *     description: Retourne les activités des utilisateurs que je suis
 *     responses:
 *       200:
 *         description: Fil d'actualité récupéré
 */
router.get('/feed', getFeed);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Obtenir un profil public
 *     description: Retourne le profil public d'un utilisateur (sans email)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Profil récupéré
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.get('/:id', getProfile);

/**
 * @swagger
 * /api/users/{id}/follow:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Suivre un utilisateur
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Utilisateur suivi
 */
router.post('/:id/follow', followUser);

/**
 * @swagger
 * /api/users/{id}/follow:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Ne plus suivre un utilisateur
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Utilisateur ne plus suivi
 */
router.delete('/:id/follow', unfollowUser);

/**
 * @swagger
 * /api/users/{id}/followers:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Lister les abonnés d'un utilisateur
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des abonnés
 */
router.get('/:id/followers', listFollowers);

/**
 * @swagger
 * /api/users/{id}/following:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Utilisateurs
 *     summary: Lister les abonnements d'un utilisateur
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des abonnements
 */
router.get('/:id/following', listFollowing);

module.exports = router;
