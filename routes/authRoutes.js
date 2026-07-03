const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/authController');
const { registerRules, loginRules, refreshRules } = require('../middleware/validators');
const { authLimiter } = require('../middleware/rateLimiter');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentification
 *     summary: Créer un nouveau compte utilisateur
 *     description: Enregistre un nouvel utilisateur et retourne un token d'accès + refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jean Dupont
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jean@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123
 *     responses:
 *       201:
 *         description: Compte créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: Token d'accès JWT (15 minutes)
 *                 refreshToken:
 *                   type: string
 *                   description: Refresh token (30 jours)
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       409:
 *         description: Email déjà utilisé
 */
router.post('/register', authLimiter, registerRules, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentification
 *     summary: Se connecter à son compte
 *     description: Authentifie l'utilisateur et retourne un token d'accès + refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Email ou mot de passe incorrect
 */
router.post('/login', authLimiter, loginRules, login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentification
 *     summary: Rafraîchir le token d'accès
 *     description: Échange un refresh token contre un nouveau token d'accès (rotation du token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token rafraîchi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 */
router.post('/refresh', refreshRules, refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentification
 *     summary: Se déconnecter
 *     description: Révoque le refresh token et termine la session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post('/logout', refreshRules, logout);

module.exports = router;
