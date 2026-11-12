const express = require('express');
const { asyncHandler: ah } = require('../middleware/errorHandler');
const { requireUser } = require('../middleware/auth');
const c = require('../controllers/productController');

const router = express.Router();

router.get('/', requireUser, ah(c.list));
router.get('/categories', requireUser, ah(c.categories));

module.exports = router;
