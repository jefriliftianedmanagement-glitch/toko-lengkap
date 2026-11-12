const supabase = require('../config/supabase');
const { fromDbError, fromRpcError } = require('../services/rpcErrors');
const { escapeLike } = require('../services/validators');
const { clampInt } = require('./productController')._internal;
const { HttpError } = require('../services/httpError');
const { logAdmin } = require('../services/audit');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseUserId(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new HttpError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
  return value;
}

// GET /api/admin/users?q=&page=&limit=   (q = username atau ID akun 10 digit)
async function list(req, res) {
  const page = clampInt(req.query.page, 1, 1, 10000);
  const limit = clampInt(req.query.limit, 10, 1, 50);
  const q = (typeof req.query.q === 'string' ? req.query.q.trim() : '').replace(/^@/, '').slice(0, 40);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('users')
    .select('id, account_id, username, is_active, created_at, wallets(balance)', { count: 'exact' });
  if (q) {
    if (/^\d{10}$/.test(q)) query = query.eq('account_id', Number(q));
    else query = query.ilike('username', `%${escapeLike(q)}%`);
  }
  query = query.order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw fromDbError(error);

  const items = (data || []).map((u) => {
    const w = Array.isArray(u.wallets) ? u.wallets[0] : u.wallets;
    return {
      id: u.id,
      account_id: u.account_id,
      username: u.username,
      is_active: u.is_active,
      created_at: u.created_at,
      balance: w ? w.balance : 0,
    };
  });

  const total = count || 0;
  res.json({ ok: true, items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
}

// PATCH /api/admin/users/:id/status - block/unblock akun, data tidak dihapus.
async function setStatus(req, res) {
  const userId = parseUserId(req.params.id);
  const blocked = req.body && req.body.blocked;
  if (typeof blocked !== 'boolean') throw new HttpError(400, 'INVALID_STATUS', 'Status block tidak valid.');

  const { data, error } = await supabase.from('users')
    .update({ is_active: !blocked })
    .eq('id', userId)
    .select('id, account_id, username, is_active')
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');

  await logAdmin(req.admin.id, blocked ? 'USER_BLOCK' : 'USER_UNBLOCK', data.account_id, {}, data.id);
  res.json({ ok: true, user: data });
}

// DELETE /api/admin/users/:id - hapus identitas permanen, jejak saldo tetap tersimpan.
async function remove(req, res) {
  const userId = parseUserId(req.params.id);
  const { data, error } = await supabase.rpc('admin_delete_user', {
    p_admin_id: req.admin.id,
    p_user_id: userId,
  });
  if (error) throw fromRpcError(error);
  res.json({ ok: true, result: data });
}

module.exports = { list, setStatus, remove, _internal: { parseUserId } };
