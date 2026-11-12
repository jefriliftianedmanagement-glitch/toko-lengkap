const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromDbError } = require('../services/rpcErrors');

const TYPES = new Set(['TOPUP_CLAIM', 'ADMIN_SEND_BALANCE', 'PURCHASE']);
const STATUSES = new Set(['SUCCESS', 'FAILED']);

function parsePage(value) {
  if (value === undefined || value === '') return 1;
  const raw = String(value);
  if (!/^\d+$/.test(raw)) throw new HttpError(400, 'INVALID_PAGE', 'Nomor halaman tidak valid.');
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) throw new HttpError(400, 'INVALID_PAGE', 'Nomor halaman tidak valid.');
  return Math.min(n, 10000);
}

function parseLimit(value, max) {
  if (value === undefined || value === '') return 10;
  const raw = String(value);
  if (!/^\d+$/.test(raw)) throw new HttpError(400, 'INVALID_LIMIT', 'Batas data tidak valid.');
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) throw new HttpError(400, 'INVALID_LIMIT', 'Batas data tidak valid.');
  return Math.min(n, max);
}

function parseChoice(value, allowed, label) {
  if (value !== undefined && value !== '' && typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_FILTER', `Filter ${label} tidak valid.`);
  }
  const v = typeof value === 'string' && value ? value.toUpperCase() : 'ALL';
  if (v === 'ALL') return 'all';
  if (!allowed.has(v)) throw new HttpError(400, 'INVALID_FILTER', `Filter ${label} tidak valid.`);
  return v;
}

function parseDate(value, label) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'INVALID_DATE', `Tanggal ${label} tidak valid.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'INVALID_DATE', `Tanggal ${label} tidak valid.`);
  }
  return value;
}

function parseFilters(query) {
  const type = parseChoice(query.type, TYPES, 'jenis transaksi');
  const status = parseChoice(query.status, STATUSES, 'status transaksi');
  const fromDate = parseDate(query.from, 'awal');
  const toDate = parseDate(query.to, 'akhir');
  if (fromDate && toDate && fromDate > toDate) {
    throw new HttpError(400, 'INVALID_DATE_RANGE', 'Tanggal awal tidak boleh melewati tanggal akhir.');
  }
  return { type, status, fromDate, toDate };
}

function applyFilters(query, filters) {
  if (filters.type !== 'all') query = query.eq('type', filters.type);
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.fromDate) query = query.gte('created_at', `${filters.fromDate}T00:00:00.000Z`);
  if (filters.toDate) {
    const endExclusive = new Date(`${filters.toDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    query = query.lt('created_at', endExclusive.toISOString());
  }
  return query;
}

// GET /api/transactions - selalu dibatasi ke user dari cookie sesi terverifikasi.
async function list(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 30);
  const filters = parseFilters(req.query);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('transactions')
    .select('id, transaction_code, type, amount, status, description, created_at', { count: 'exact' })
    .eq('user_id', req.user.id)
    .is('user_hidden_at', null)
    .is('admin_deleted_at', null);
  query = applyFilters(query, filters)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw fromDbError(error);

  const total = count || 0;
  res.json({
    ok: true,
    items: (data || []).map((item) => ({
      id: item.id,
      transaction_code: item.transaction_code,
      type: item.type,
      amount: item.amount,
      status: item.status,
      description: item.description,
      created_at: item.created_at,
    })),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

// DELETE /api/transactions/:id - hanya menyembunyikan dari riwayat user ini.
async function remove(req, res) {
  const id = req.params.id;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'Transaksi tidak ditemukan.');

  const { data, error } = await supabase.from('transactions')
    .update({ user_hidden_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', req.user.id)
    .is('user_hidden_at', null)
    .is('admin_deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'Transaksi tidak ditemukan.');
  res.json({ ok: true, hidden: true });
}

module.exports = { list, remove, _internal: { parsePage, parseLimit, parseChoice, parseDate, parseFilters, applyFilters, TYPES, STATUSES } };
