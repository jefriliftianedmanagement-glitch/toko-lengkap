const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromRpcError, fromDbError } = require('../services/rpcErrors');
const { escapeLike } = require('../services/validators');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CLAIMED', 'CANCELLED'];

function parseRequestId(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(404, 'NOT_FOUND', 'Permintaan top-up tidak ditemukan.');
  }
  return value;
}

function parseReason(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_REASON', 'Alasan penolakan tidak valid.');
  }
  const reason = value.trim();
  if (reason.length > 250) {
    throw new HttpError(400, 'INVALID_REASON', 'Alasan penolakan maksimal 250 karakter.');
  }
  return reason || null;
}

// GET /api/admin/topups?status=PENDING|all&q=&page=&limit=
async function list(req, res) {
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
  const statusInput = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'PENDING';
  const status = statusInput === 'ALL' ? 'all' : STATUSES.includes(statusInput) ? statusInput : 'PENDING';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 50) : '';

  let userIds = null;
  if (q) {
    const lookups = [
      supabase.from('users').select('id').ilike('username', `%${escapeLike(q)}%`).limit(250),
    ];
    if (/^\d{10}$/.test(q)) {
      lookups.push(supabase.from('users').select('id').eq('account_id', Number(q)).limit(5));
    }
    const results = await Promise.all(lookups);
    for (const result of results) {
      if (result.error) throw fromDbError(result.error);
    }
    userIds = [...new Set(results.flatMap((r) => (r.data || []).map((u) => u.id)))];
    if (!userIds.length) {
      return res.json({ ok: true, items: [], page, limit, total: 0, pages: 1, status, q });
    }
  }

  let query = supabase
    .from('topup_requests')
    .select('id, user_id, amount, status, created_at, processed_at, claimed_at, user:users!topup_requests_user_id_fkey(username, account_id)', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  if (userIds) query = query.in('user_id', userIds);

  const from = (page - 1) * limit;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + limit - 1);
  if (error) throw fromDbError(error);

  const total = count || 0;
  res.json({
    ok: true,
    items: data || [],
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    status,
    q,
  });
}

// POST /api/admin/topups/:id/approve
async function approve(req, res) {
  const requestId = parseRequestId(req.params.id);
  const { data, error } = await supabase.rpc('admin_approve_topup', {
    p_admin_id: req.admin.id,
    p_request_id: requestId,
  });
  if (error) throw fromRpcError(error);
  res.json({ ok: true, request: data });
}

// POST /api/admin/topups/:id/reject
async function reject(req, res) {
  const requestId = parseRequestId(req.params.id);
  const reason = parseReason(req.body && req.body.reason);
  const { data, error } = await supabase.rpc('admin_reject_topup', {
    p_admin_id: req.admin.id,
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) throw fromRpcError(error);
  res.json({ ok: true, request: data });
}

module.exports = { list, approve, reject };
