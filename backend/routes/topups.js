const express = require('express');
const { asyncHandler: ah } = require('../middleware/errorHandler');
const { requireUser } = require('../middleware/auth');
const { topupLimiter } = require('../middleware/rateLimiters');
const c = require('../controllers/topupController');

const router = express.Router();
router.use(requireUser);
router.get('/', ah(c.list));
router.post('/', topupLimiter, ah(c.create));
router.delete('/:id', ah(c.cancel));

module.exports = router;
