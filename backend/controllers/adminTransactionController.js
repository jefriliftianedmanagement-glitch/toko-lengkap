const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromDbError } = require('../services/rpcErrors');
const userTransactions = require('./transactionController');
const { escapeLike } = require('../services/validators');

const { parsePage, parseLimit, parseFilters, applyFilters } = userTransactions._internal;
const SELECT_FIELDS = 'id, user_id, transaction_code, type, amount, status, description, created_at, user_hidden_at';

function parseSearch(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') throw new HttpError(400, 'INVALID_SEARCH', 'Kata kunci pencarian tidak valid.');
  const q = value.trim().replace(/^@/, '');
  if (q.length > 50 || (q && !/^[A-Za-z0-9_-]{1,50}$/.test(q))) {
    throw new HttpError(400, 'INVALID_SEARCH', 'Gunakan username, ID akun 10 digit, atau kode transaksi.');
  }
  return q;
}

// GET /api/admin/transactions - seluruh transaksi, khusus sesi admin.
async function list(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 50);
  const filters = parseFilters(req.query);
  const q = parseSearch(req.query.q);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('transactions').select(SELECT_FIELDS, { count: 'exact' }).is('admin_deleted_at', null);
  query = applyFilters(query, filters);

  if (q) {
    if (/^\d{10}$/.test(q)) {
      const { data: user, error: userError } = await supabase
        .from('users').select('id').eq('account_id', Number(q)).maybeSingle();
      if (userError) throw fromDbError(userError);
      if (!user) {
        return res.json({ ok: true, items: [], page, limit, total: 0, pages: 1 });
      }
      query = query.eq('user_id', user.id);
    } else if (/^TRX-/i.test(q)) {
      query = query.ilike('transaction_code', `%${escapeLike(q)}%`);
    } else {
      const { data: users, error: usersError } = await supabase
        .from('users').select('id').ilike('username', `%${escapeLike(q)}%`).limit(500);
      if (usersError) throw fromDbError(usersError);
      const ids = (users || []).map((u) => u.id);
      if (!ids.length) {
        return res.json({ ok: true, items: [], page, limit, total: 0, pages: 1 });
      }
      query = query.in('user_id', ids);
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (error) throw fromDbError(error);

  const userIds = [...new Set((data || []).map((t) => t.user_id).filter(Boolean))];
  let usersById = new Map();
  if (userIds.length) {
    const { data: users, error: usersError } = await supabase
      .from('users').select('id, username, account_id').in('id', userIds);
    if (usersError) throw fromDbError(usersError);
    usersById = new Map((users || []).map((u) => [u.id, u]));
  }
  const items = (data || []).map((t) => {
    const user = usersById.get(t.user_id);
    return {
      id: t.id,
      transaction_code: t.transaction_code,
      type: t.type,
      amount: t.amount,
      status: t.status,
      description: t.description,
      created_at: t.created_at,
      username: user ? user.username : null,
      account_id: user ? user.account_id : null,
      user_hidden_at: t.user_hidden_at,
    };
  });
  const total = count || 0;
  res.json({ ok: true, items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
}

// DELETE /api/admin/transactions/:id - global soft-delete, ledger tidak disentuh.
async function remove(req, res) {
  const id = req.params.id;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'Transaksi tidak ditemukan.');

  const { data, error } = await supabase.from('transactions')
    .update({ admin_deleted_at: new Date().toISOString(), admin_deleted_by: req.admin.id })
    .eq('id', id)
    .is('admin_deleted_at', null)
    .select('id, transaction_code, user_id')
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'Transaksi tidak ditemukan.');
  await require('../services/audit').logAdmin(req.admin.id, 'TRANSACTION_HIDE_GLOBAL', data.transaction_code, {}, null);
  res.json({ ok: true, deleted: true, financial_record_retained: true });
}

module.exports = { list, remove, _internal: { parseSearch } };
