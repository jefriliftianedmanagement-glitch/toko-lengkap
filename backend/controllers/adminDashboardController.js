const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromDbError } = require('../services/rpcErrors');

// GET /api/admin/dashboard -> angka ringkasan + 10 transaksi terbaru
async function stats(req, res) {
  const [s, t] = await Promise.all([
    supabase.rpc('admin_dashboard_stats'),
    supabase
      .from('transactions')
      .select('user_id, transaction_code, type, amount, status, description, created_at')
      .is('admin_deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (s.error) {
    if (s.error.code === 'PGRST202' || /admin_dashboard_stats/.test(s.error.message || '')) {
      console.error('[STATS] fungsi admin_dashboard_stats belum ada:', s.error.message);
      throw new HttpError(
        500,
        'STATS_NOT_READY',
        'Fungsi statistik belum ada di database. Jalankan database/part4.sql di Supabase SQL Editor.'
      );
    }
    throw fromDbError(s.error);
  }
  if (t.error) throw fromDbError(t.error);

  const recentUserIds = [...new Set((t.data || []).map((x) => x.user_id).filter(Boolean))];
  let usersById = new Map();
  if (recentUserIds.length) {
    const { data: users, error: usersError } = await supabase
      .from('users').select('id, username, account_id').in('id', recentUserIds);
    if (usersError) throw fromDbError(usersError);
    usersById = new Map((users || []).map((u) => [u.id, u]));
  }
  const recent = (t.data || []).map((x) => {
    const user = usersById.get(x.user_id);
    return {
      transaction_code: x.transaction_code,
      type: x.type,
      amount: x.amount,
      status: x.status,
      description: x.description,
      created_at: x.created_at,
      username: user ? user.username : null,
      account_id: user ? user.account_id : null,
    };
  });

  res.json({ ok: true, stats: s.data, recent });
}

module.exports = { stats };
