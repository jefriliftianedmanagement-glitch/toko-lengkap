const express = require('express');
const { asyncHandler: ah } = require('../middleware/errorHandler');
const { requireUser } = require('../middleware/auth');
const controller = require('../controllers/transactionController');

const router = express.Router();
router.use(requireUser);
router.get('/', ah(controller.list));
router.delete('/:id', ah(controller.remove));

module.exports = router;
