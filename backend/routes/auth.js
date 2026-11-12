const express = require('express');
const { asyncHandler: ah } = require('../middleware/errorHandler');
const { authLimiter, loginAccountLimiter } = require('../middleware/rateLimiters');
const { requireUser } = require('../middleware/auth');
const c = require('../controllers/authController');

const router = express.Router();

router.post('/register', authLimiter, ah(c.register));
router.post('/login', authLimiter, loginAccountLimiter, ah(c.login));
router.post('/logout', c.logout);
router.get('/me', requireUser, ah(c.me));

module.exports = router;
