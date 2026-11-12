const express = require('express');
const { asyncHandler: ah } = require('../middleware/errorHandler');
const { authLimiter, loginAccountLimiter } = require('../middleware/rateLimiters');
const { requireAdmin } = require('../middleware/auth');
const c = require('../controllers/adminAuthController');

const router = express.Router();

router.post('/login', authLimiter, loginAccountLimiter, ah(c.login));
router.post('/logout', c.logout);
router.get('/me', requireAdmin, c.me);

module.exports = router;
