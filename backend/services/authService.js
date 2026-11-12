const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { HttpError } = require('./httpError');
const { fromRpcError, fromDbError } = require('./rpcErrors');
const { escapeLike } = require('./validators');

const BCRYPT_COST = 12;

// Hash palsu untuk menyamakan waktu respons saat username tidak ditemukan
// (mencegah penyerang menebak username yang terdaftar lewat selisih waktu).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

const INVALID_CREDENTIALS = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');

// Registrasi: hash di backend, pembuatan akun + wallet + ID 10 digit di DB (RPC atomic)
async function registerUser(username, password) {
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const { data, error } = await supabase.rpc('register_user', {
    p_username: username,
    p_password_hash: hash,
  });
  if (error) throw fromRpcError(error);
  return { id: data.user_id, account_id: data.account_id, username: data.username };
}

async function loginUser(username, password) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, account_id, username, password_hash, avatar_url, is_active')
    .ilike('username', escapeLike(username))
    .maybeSingle();
  if (error) throw fromDbError(error);

  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok || !user.is_active) throw INVALID_CREDENTIALS();

  return {
    id: user.id,
    account_id: user.account_id,
    username: user.username,
    avatar_url: user.avatar_url,
  };
}

async function loginAdmin(username, password) {
  const { data: admin, error } = await supabase
    .from('admins')
    .select('id, username, password_hash, is_active')
    .eq('username', username)
    .maybeSingle();
  if (error) throw fromDbError(error);

  const ok = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
  if (!admin || !ok || !admin.is_active) throw INVALID_CREDENTIALS();

  return { id: admin.id, username: admin.username };
}

// Data untuk header aplikasi: profil + saldo + jumlah pesan belum dibaca
async function getUserProfile(userId) {
  const [walletRes, unreadRes] = await Promise.all([
    supabase.from('wallets').select('balance').eq('user_id', userId).single(),
    supabase
      .from('user_inbox')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false),
  ]);
  if (walletRes.error) throw fromDbError(walletRes.error);
  if (unreadRes.error) throw fromDbError(unreadRes.error);
  return { balance: walletRes.data.balance, unread_count: unreadRes.count || 0 };
}

module.exports = { registerUser, loginUser, loginAdmin, getUserProfile };
