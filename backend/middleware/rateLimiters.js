const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const handler = (req, res) =>
  res.status(429).json({
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' },
  });

const common = { standardHeaders: true, legacyHeaders: false, handler };

// Umum untuk seluruh API
const apiLimiter = rateLimit({ ...common, windowMs: 60 * 1000, max: 300 });

// Login/registrasi per IP
const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, max: env.AUTH_RATE_MAX });

// Batasi pembuatan request top-up per alamat IP
const topupLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => req.user.id,
});

// Anti brute-force per kombinasi IP + username (hanya hitung percobaan gagal)
const adminSendBalanceLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.admin.id,
});

const loginAccountLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${req.ip}|${String((req.body && req.body.username) || '').toLowerCase().slice(0, 40)}`,
});

module.exports = { apiLimiter, authLimiter, loginAccountLimiter, topupLimiter, adminSendBalanceLimiter };
