const { HttpError } = require('../services/httpError');
const env = require('../config/env');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Perlindungan CSRF berlapis untuk auth berbasis cookie:
//  1. Cookie bersifat SameSite=Strict (lihat services/tokens.js)
//  2. Origin (jika ada) harus sama dengan host server, atau terdaftar di ALLOWED_ORIGINS
//     (dipakai saat situs di Netlify mem-proxy /api ke backend di server lain)
//  3. Request yang mengubah data wajib membawa header "X-Requested-With: fetch"
//     (header kustom tidak bisa dikirim lintas-situs tanpa preflight CORS)
function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      return next(new HttpError(403, 'CSRF_ORIGIN', 'Origin tidak valid.'));
    }
    const sameHost = parsed.host === req.get('host');
    const allowed = env.ALLOWED_ORIGINS.includes(parsed.origin);
    if (!sameHost && !allowed) {
      return next(new HttpError(403, 'CSRF_ORIGIN', 'Origin tidak diizinkan.'));
    }
  }

  if (req.get('x-requested-with') !== 'fetch') {
    return next(new HttpError(403, 'CSRF_HEADER', 'Header permintaan tidak valid.'));
  }
  next();
}

module.exports = csrfGuard;
