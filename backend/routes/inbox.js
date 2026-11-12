const express = require('express');
const { asyncHandler: ah } = require('../middleware/errorHandler');
const { requireUser } = require('../middleware/auth');
const c = require('../controllers/inboxController');

const router = express.Router();
router.use(requireUser);
router.get('/', ah(c.list));
router.post('/read-all', ah(c.markAllRead));
router.delete('/:id', ah(c.remove));
router.post('/:id/read', ah(c.markRead));
router.post('/:id/claim', ah(c.claim));

module.exports = router;
