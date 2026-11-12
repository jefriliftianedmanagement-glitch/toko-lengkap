const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromRpcError, fromDbError } = require('../services/rpcErrors');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseMessageId(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(404, 'MESSAGE_NOT_FOUND', 'Pesan tidak ditemukan.');
  }
  return value;
}

function parsePage(value) {
  const n = Number.parseInt(value, 10);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
}

function parseLimit(value) {
  const n = Number.parseInt(value, 10);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 30) : 10;
}

async function unreadCount(userId) {
  const { count, error } = await supabase
    .from('user_inbox')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('hidden_at', null)
    .eq('is_read', false);
  if (error) throw fromDbError(error);
  return count || 0;
}

// GET /api/inbox - pesan milik akun yang sedang login saja.
async function list(req, res) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const filter = typeof req.query.filter === 'string' ? req.query.filter.toLowerCase() : 'all';
  if (!['all', 'unread', 'read'].includes(filter)) {
    throw new HttpError(400, 'INVALID_FILTER', 'Filter inbox tidak valid.');
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = supabase
    .from('user_inbox')
    .select('id, type, title, body, is_read, claimed_at, created_at', { count: 'exact' })
    .eq('user_id', req.user.id)
    .is('hidden_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (filter === 'unread') query = query.eq('is_read', false);
  if (filter === 'read') query = query.eq('is_read', true);

  const [messagesRes, unread] = await Promise.all([
    query.range(from, to),
    unreadCount(req.user.id),
  ]);
  if (messagesRes.error) throw fromDbError(messagesRes.error);

  const total = messagesRes.count || 0;
  res.json({
    ok: true,
    items: messagesRes.data || [],
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    unread_count: unread,
  });
}

// POST /api/inbox/:id/read - tidak pernah bisa mengubah pesan milik user lain.
async function markRead(req, res) {
  const messageId = parseMessageId(req.params.id);
  const { data, error } = await supabase
    .from('user_inbox')
    .update({ is_read: true })
    .eq('id', messageId)
    .eq('user_id', req.user.id)
    .is('hidden_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new HttpError(404, 'MESSAGE_NOT_FOUND', 'Pesan tidak ditemukan.');

  res.json({ ok: true, unread_count: await unreadCount(req.user.id) });
}

// POST /api/inbox/read-all - hanya menandai pesan user yang sedang login.
async function markAllRead(req, res) {
  const { data, error } = await supabase
    .from('user_inbox')
    .update({ is_read: true })
    .eq('user_id', req.user.id)
    .is('hidden_at', null)
    .eq('is_read', false)
    .select('id');
  if (error) throw fromDbError(error);

  res.json({
    ok: true,
    marked_count: Array.isArray(data) ? data.length : 0,
    unread_count: await unreadCount(req.user.id),
  });
}

// POST /api/inbox/:id/claim - nominal dan kepemilikan diverifikasi ulang oleh RPC SQL.
async function claim(req, res) {
  const messageId = parseMessageId(req.params.id);
  const { data, error } = await supabase.rpc('claim_topup', {
    p_user_id: req.user.id,
    p_inbox_id: messageId,
  });
  if (error) throw fromRpcError(error);

  res.json({
    ok: true,
    claim: data,
    unread_count: await unreadCount(req.user.id),
  });
}

// DELETE /api/inbox/:id - hanya menyembunyikan pesan milik user aktif.
async function remove(req, res) {
  const messageId = parseMessageId(req.params.id);
  const { data, error } = await supabase.rpc('hide_user_inbox_message', {
    p_user_id: req.user.id,
    p_message_id: messageId,
  });
  if (error) throw fromRpcError(error);
  res.json({ ok: true, result: data, unread_count: await unreadCount(req.user.id) });
}

module.exports = { list, markRead, markAllRead, claim, remove };
