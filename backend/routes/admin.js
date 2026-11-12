const express = require('express');
const { asyncHandler: ah } = require('../middleware/errorHandler');
const { requireAdmin } = require('../middleware/auth');
const dashboard = require('../controllers/adminDashboardController');
const products = require('../controllers/adminProductController');
const users = require('../controllers/adminUserController');
const topups = require('../controllers/adminTopupController');
const sendBalance = require('../controllers/adminSendBalanceController');
const transactions = require('../controllers/adminTransactionController');
const { adminSendBalanceLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// SEMUA endpoint di bawah ini hanya untuk admin (cookie admin_token yang valid)
router.use(requireAdmin);

router.get('/dashboard', ah(dashboard.stats));
router.get('/users', ah(users.list));
router.patch('/users/:id/status', ah(users.setStatus));
router.delete('/users/:id', ah(users.remove));
router.get('/transactions', ah(transactions.list));
router.delete('/transactions/:id', ah(transactions.remove));

router.get('/topups', ah(topups.list));
router.post('/send-balance', adminSendBalanceLimiter, ah(sendBalance.send));
router.post('/topups/:id/approve', ah(topups.approve));
router.post('/topups/:id/reject', ah(topups.reject));

router.get('/products', ah(products.list));
router.get('/products/categories', ah(products.categories));
router.post('/products', ah(products.create));
router.patch('/products/:id', ah(products.update));
router.delete('/products/:id', ah(products.remove));

// Upload gambar: body = file mentah (bukan JSON). Maks 2 MB, tipe diverifikasi dari isi file.
router.post(
  '/uploads/product-image',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '2mb' }),
  ah(products.uploadProductImage)
);

module.exports = router;
