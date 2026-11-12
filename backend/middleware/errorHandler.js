const { HttpError } = require('../services/httpError');

// Membungkus handler async agar error otomatis masuk ke errorHandler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ ok: false, error: { code: err.code, message: err.message } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ ok: false, error: { code: 'BAD_JSON', message: 'Format JSON tidak valid.' } });
  }
  if (err && err.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ ok: false, error: { code: 'TOO_LARGE', message: 'Data terlalu besar.' } });
  }

  console.error('[UNHANDLED ERROR]', err);
  res
    .status(500)
    .json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' } });
}

module.exports = { asyncHandler, notFound, errorHandler };
