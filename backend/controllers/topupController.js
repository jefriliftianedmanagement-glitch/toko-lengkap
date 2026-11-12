const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromRpcError, fromDbError } = require('../services/rpcErrors');

const MAX_AMOUNT = 1000000000000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseAmount(value) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,13}$/.test(raw)) {
    throw new HttpError(400, 'INVALID_AMOUNT', 'Nominal harus berupa bilangan bulat positif.');
  }
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new HttpError(400, 'INVALID_AMOUNT', 'Nominal harus lebih dari Rp0 dan tidak melebihi batas sistem.');
  }
  return amount;
}

function parseRequestId(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(404, 'NOT_FOUND', 'Permintaan top-up tidak ditemukan.');
  }
  return value;
}

// GET /api/topups - request milik user yang sedang login saja
async function list(req, res) {
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(20, Number.parseInt(req.query.limit, 10) || 10));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('topup_requests')
    .select('id, amount, status, created_at, processed_at, claimed_at', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to);
  if (error) throw fromDbError(error);

  const total = count || 0;
  res.json({
    ok: true,
    items: data || [],
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

// POST /api/topups - saldo belum berubah pada tahap request
async function create(req, res) {
  const amount = parseAmount(req.body && req.body.amount);
  const { data, error } = await supabase.rpc('create_topup_request', {
    p_user_id: req.user.id,
    p_amount: amount,
  });
  if (error) throw fromRpcError(error);
  res.status(201).json({ ok: true, request: data });
}

// DELETE /api/topups/:id - hanya request PENDING milik user ini
async function cancel(req, res) {
  const requestId = parseRequestId(req.params.id);
  const { data, error } = await supabase.rpc('cancel_topup_request', {
    p_user_id: req.user.id,
    p_request_id: requestId,
  });
  if (error) throw fromRpcError(error);
  res.json({ ok: true, request: data });
}

module.exports = { list, create, cancel };
