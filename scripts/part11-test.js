/* PART 11 static security checks; no .env or live Supabase required. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

check('migration mempertahankan ledger dan transaksi; tidak melakukan hard-delete keuangan', () => {
  const sql = read('database/part11.sql');
  assert.match(sql, /wallets_user_id_fkey[\s\S]*?on delete cascade/i);
  assert.match(sql, /topup_requests_user_id_fkey[\s\S]*?on delete set null/i);
  assert.match(sql, /drop constraint if exists transactions_user_id_fkey/i);
  assert.match(sql, /drop constraint if exists wallet_ledger_user_id_fkey/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(transactions|wallet_ledger)/i);
});
check('hapus akun permanen hanya melalui RPC admin dan audit tercatat', () => {
  const sql = read('database/part11.sql');
  const controller = read('backend/controllers/adminUserController.js');
  assert.match(sql, /function public\.admin_delete_user/i);
  assert.match(sql, /USER_PERMANENT_DELETE/i);
  assert.match(sql, /status in \('PENDING', 'APPROVED'\)/i);
  assert.match(sql, /grant execute on function public\.admin_delete_user\(uuid, uuid\) to service_role/i);
  assert.match(controller, /supabase\.rpc\('admin_delete_user'/);
  assert.match(controller, /update\(\{ is_active: !blocked \}\)/);
});
check('block dan unblock menggunakan route admin terautentikasi', () => {
  const routes = read('backend/routes/admin.js');
  assert.match(routes, /router\.use\(requireAdmin\)/);
  assert.match(routes, /patch\('\/users\/:id\/status'/i);
  assert.match(routes, /delete\('\/users\/:id'/i);
  assert.match(read('admin/js/users.js'), /Block akun/);
  assert.match(read('admin/js/users.js'), /Unblock/);
  assert.match(read('admin/js/users.js'), /Hapus permanen/);
});
check('hapus transaksi user dibatasi ke pemilik sesi dan soft-delete', () => {
  const controller = read('backend/controllers/transactionController.js');
  assert.match(controller, /\.eq\('user_id', req\.user\.id\)/);
  assert.match(controller, /user_hidden_at: new Date\(\)\.toISOString\(\)/);
  assert.match(controller, /\.is\('admin_deleted_at', null\)/);
  assert.match(read('frontend/js/history.js'), /Hapus dari riwayat/);
});
check('hapus transaksi admin global soft-delete dan audit; tidak menyentuh ledger', () => {
  const controller = read('backend/controllers/adminTransactionController.js');
  assert.match(controller, /admin_deleted_at: new Date\(\)\.toISOString\(\)/);
  assert.match(controller, /TRANSACTION_HIDE_GLOBAL/);
  assert.match(read('backend/routes/admin.js'), /delete\('\/transactions\/:id'/i);
  assert.match(read('admin/js/transactions.js'), /Hapus transaksi dari seluruh riwayat/);
});
check('dashboard admin tetap bisa menampilkan transaksi setelah relasi FK user dilepas', () => {
  const dashboard = read('backend/controllers/adminDashboardController.js');
  assert.match(dashboard, /select\('user_id, transaction_code/);
  assert.match(dashboard, /from\('users'\)\.select\('id, username, account_id'\)\.in\('id', recentUserIds\)/);
  assert.doesNotMatch(dashboard, /users\(username, account_id\)/);
});
check('hapus inbox membatasi user dan melindungi pesan klaim saldo yang belum diklaim', () => {
  const sql = read('database/part11.sql');
  const controller = read('backend/controllers/inboxController.js');
  assert.match(sql, /function public\.hide_user_inbox_message/i);
  assert.match(sql, /v_type = 'TOPUP_APPROVED' and v_claimed_at is null/i);
  assert.match(controller, /supabase\.rpc\('hide_user_inbox_message'/);
  assert.match(read('backend/routes/inbox.js'), /router\.delete\('\/:id'/i);
  assert.match(read('frontend/js/mailbox.js'), /Klaim saldo sebelum menghapus pesan ini/);
});

console.log(`\nPART 11: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
