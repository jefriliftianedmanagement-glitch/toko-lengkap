const express = require('express');
const supabase = require('../config/supabase');
const { asyncHandler: ah } = require('../middleware/errorHandler');
const csrfGuard = require('../middleware/csrf');
const authRoutes = require('./auth');
const adminAuthRoutes = require('./adminAuth');
const productRoutes = require('./products');
const topupRoutes = require('./topups');
const inboxRoutes = require('./inbox');
const transactionRoutes = require('./transactions');
const adminRoutes = require('./admin');

const router = express.Router();

// Cek server + koneksi database (tanpa membocorkan detail error)
router.get(
  '/health',
  ah(async (req, res) => {
    const { error } = await supabase.from('admins').select('id', { count: 'exact', head: true });
    if (error) console.error('[HEALTH] DB error:', error.message);
    res.status(error ? 503 : 200).json({ ok: !error, db: !error });
  })
);

// Semua request yang mengubah data wajib lolos pemeriksaan CSRF
router.use(csrfGuard);

router.use('/auth', authRoutes); // PART 2
router.use('/admin/auth', adminAuthRoutes); // PART 2
router.use('/products', productRoutes); // PART 3
router.use('/topups', topupRoutes); // PART 5
router.use('/inbox', inboxRoutes); // PART 6: mailbox + claim balance
router.use('/transactions', transactionRoutes); // PART 8: riwayat user (terisolasi per akun)
// PENTING: '/admin' harus SESUDAH '/admin/auth' (login admin tidak boleh kena requireAdmin)
router.use('/admin', adminRoutes); // PART 4-7: dashboard, produk, top-up, pengguna, send balance

// Endpoint riwayat admin didaftarkan di backend/routes/admin.js.

module.exports = router;
