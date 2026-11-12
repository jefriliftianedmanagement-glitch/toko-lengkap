const { HttpError } = require('../services/httpError');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Perlindungan CSRF berlapis untuk auth berbasis cookie:
//  1. Cookie bersifat SameSite=Strict (lihat services/tokens.js)
//  2. Origin (jika ada) harus sama dengan host server
//  3. Request yang mengubah data wajib membawa header "X-Requested-With: fetch"
//     (header kustom tidak bisa dikirim lintas-situs tanpa preflight CORS)
function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      return next(new HttpError(403, 'CSRF_ORIGIN', 'Origin tidak valid.'));
    }
    if (originHost !== req.get('host')) {
      return next(new HttpError(403, 'CSRF_ORIGIN', 'Origin tidak diizinkan.'));
    }
  }

  if (req.get('x-requested-with') !== 'fetch') {
    return next(new HttpError(403, 'CSRF_HEADER', 'Header permintaan tidak valid.'));
  }
  next();
}

module.exports = csrfGuard;
