const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { registerRules, loginRules } = require('../middleware/validators');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, registerRules, register);
router.post('/login', authLimiter, loginRules, login);

module.exports = router;
