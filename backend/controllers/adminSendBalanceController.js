const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromRpcError } = require('../services/rpcErrors');

const MAX_AMOUNT = 1000000000000;
const ACCOUNT_ID_RE = /^[1-9]\d{9}$/;

function parseAccountId(value) {
  if (typeof value !== 'string' || !ACCOUNT_ID_RE.test(value)) {
    throw new HttpError(400, 'INVALID_ACCOUNT_ID', 'ID akun harus terdiri dari tepat 10 digit angka.');
  }
  return Number(value);
}

function parseAmount(value) {
  const isDigits = typeof value === 'string' && /^\d{1,13}$/.test(value);
  if (!(typeof value === 'number' && Number.isSafeInteger(value)) && !isDigits) {
    throw new HttpError(400, 'INVALID_AMOUNT', 'Nominal harus berupa bilangan bulat positif.');
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new HttpError(400, 'INVALID_AMOUNT', 'Nominal harus antara Rp1 dan Rp1.000.000.000.000.');
  }
  return amount;
}

function parseNote(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_NOTE', 'Catatan pengiriman tidak valid.');
  }
  const note = value.trim();
  if (note.length > 250) {
    throw new HttpError(400, 'INVALID_NOTE', 'Catatan maksimal 250 karakter.');
  }
  return note;
}

// POST /api/admin/send-balance
// Identitas admin berasal dari cookie sesi terverifikasi, bukan dari request body.
async function send(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const accountId = parseAccountId(body.account_id);
  const amount = parseAmount(body.amount);
  const note = parseNote(body.note);

  const { data, error } = await supabase.rpc('admin_send_balance', {
    p_admin_id: req.admin.id,
    p_target_account_id: accountId,
    p_amount: amount,
    p_note: note,
  });
  if (error) throw fromRpcError(error);

  res.status(201).json({ ok: true, result: data });
}

module.exports = { send, _internal: { parseAccountId, parseAmount, parseNote, MAX_AMOUNT } };
