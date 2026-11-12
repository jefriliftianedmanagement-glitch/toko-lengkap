const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromDbError } = require('../services/rpcErrors');
const { verifyToken, readCookie, clearAuthCookie } = require('../services/tokens');

const unauthorized = () => new HttpError(401, 'UNAUTHORIZED', 'Silakan login terlebih dahulu.');

// Identitas SELALU diambil dari token yang ditandatangani server + dicek ulang ke DB.
// Tidak pernah dari body/query yang dikirim frontend.
async function requireUser(req, res, next) {
  try {
    const payload = verifyToken(readCookie(req, 'user'), 'user');
    if (!payload) return next(unauthorized());

    const { data, error } = await supabase
      .from('users')
      .select('id, account_id, username, avatar_url, is_active')
      .eq('id', payload.sub)
      .maybeSingle();
    if (error) return next(fromDbError(error));

    if (!data || !data.is_active) {
      clearAuthCookie(res, 'user');
      return next(unauthorized());
    }
    req.user = data;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const payload = verifyToken(readCookie(req, 'admin'), 'admin');
    if (!payload) return next(unauthorized());

    const { data, error } = await supabase
      .from('admins')
      .select('id, username, is_active')
      .eq('id', payload.sub)
      .maybeSingle();
    if (error) return next(fromDbError(error));

    if (!data || !data.is_active) {
      clearAuthCookie(res, 'admin');
      return next(unauthorized());
    }
    req.admin = data;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireUser, requireAdmin };
