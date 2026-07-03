const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/authController');
const { registerRules, loginRules, refreshRules } = require('../middleware/validators');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, registerRules, register);
router.post('/login', authLimiter, loginRules, login);

// /refresh n'est pas soumis au limiteur strict : un client légitime le sollicite
// régulièrement (à chaque expiration du token d'accès). Le limiteur global /api suffit.
router.post('/refresh', refreshRules, refresh);
router.post('/logout', refreshRules, logout);

module.exports = router;
