// Unit security tests PART 8. Tidak membutuhkan .env atau koneksi Supabase.
// Menggunakan mock Supabase untuk memeriksa pembatasan pemilik data dan validasi filter.
'use strict';

const assert = require('node:assert/strict');
const supabasePath = require.resolve('../backend/config/supabase');
const traces = [];

const fakeTransaction = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'target-user-id',
  transaction_code: 'TRX-20261112-ABCDEF012345',
  type: 'ADMIN_SEND_BALANCE',
  amount: 25000,
  status: 'SUCCESS',
  description: 'Saldo dari administrator',
  created_at: '2026-11-12T10:00:00.000Z',
};

class FakeQuery {
  constructor(table) {
    this.table = table;
    this.calls = [];
    traces.push(this);
  }
  select(...args) { this.calls.push(['select', ...args]); return this; }
  eq(...args) { this.calls.push(['eq', ...args]); return this; }
  is(...args) { this.calls.push(['is', ...args]); return this; }
  in(...args) { this.calls.push(['in', ...args]); return this; }
  ilike(...args) { this.calls.push(['ilike', ...args]); return this; }
  gte(...args) { this.calls.push(['gte', ...args]); return this; }
  lt(...args) { this.calls.push(['lt', ...args]); return this; }
  order(...args) { this.calls.push(['order', ...args]); return this; }
  range(...args) { this.calls.push(['range', ...args]); return this; }
  limit(...args) { this.calls.push(['limit', ...args]); return this; }
  maybeSingle() {
    this.calls.push(['maybeSingle']);
    return Promise.resolve({ data: { id: 'target-user-id' }, error: null });
  }
  then(resolve, reject) {
    let data = [];
    if (this.table === 'transactions') {
      data = [{ ...fakeTransaction }];
    } else if (this.table === 'users') {
      data = [{ id: 'target-user-id', username: 'target_user', account_id: 1234567890 }];
    }
    return Promise.resolve({ data, count: data.length, error: null }).then(resolve, reject);
  }
}

const fakeSupabase = { from: (table) => new FakeQuery(table) };
require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: fakeSupabase,
};

const userController = require('../backend/controllers/transactionController');
const adminController = require('../backend/controllers/adminTransactionController');

let passed = 0;
let failed = 0;
function check(label, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  PASS  ${label}\n`);
  } catch (err) {
    failed++;
    process.stdout.write(`  FAIL  ${label} -> ${err.message}\n`);
  }
}
function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}
function lastTrace(table, start) {
  return traces.slice(start).filter((q) => q.table === table).at(-1);
}

(async () => {
  const v = userController._internal;
  check('page dan limit dibatasi di backend', () => {
    assert.equal(v.parsePage('99999'), 10000);
    assert.equal(v.parseLimit('999', 30), 30);
  });
  check('jenis dan status hanya menerima nilai allowlist', () => {
    assert.equal(v.parseChoice('topup_claim', v.TYPES, 'jenis'), 'TOPUP_CLAIM');
    assert.equal(v.parseChoice('success', v.STATUSES, 'status'), 'SUCCESS');
    assert.throws(() => v.parseChoice('DELETE_ALL', v.TYPES, 'jenis'), /tidak valid/);
    assert.throws(() => v.parseChoice(['PURCHASE'], v.TYPES, 'jenis'), /tidak valid/);
  });
  check('tanggal kalender tidak valid ditolak', () => {
    assert.throws(() => v.parseDate('2026-02-31', 'awal'), /tidak valid/);
  });
  check('rentang tanggal terbalik ditolak', () => {
    assert.throws(() => v.parseFilters({ from: '2026-11-13', to: '2026-11-12' }), /tidak boleh melewati/);
  });

  const startUser = traces.length;
  const userRes = response();
  await userController.list({
    user: { id: 'session-user-a' },
    query: { user_id: 'victim-user-b', type: 'TOPUP_CLAIM', from: '2026-11-01' },
  }, userRes);
  const userQuery = lastTrace('transactions', startUser);
  check('riwayat user selalu di-scope ke ID dari sesi, bukan query browser', () => {
    assert(userQuery.calls.some((c) => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'session-user-a'));
    assert(!userQuery.calls.some((c) => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'victim-user-b'));
  });
  check('filter jenis dan tanggal diterapkan di query user', () => {
    assert(userQuery.calls.some((c) => c[0] === 'eq' && c[1] === 'type' && c[2] === 'TOPUP_CLAIM'));
    assert(userQuery.calls.some((c) => c[0] === 'gte' && c[1] === 'created_at'));
  });
  check('respons user hanya berisi field transaksi yang diizinkan', () => {
    const select = userQuery.calls.find((c) => c[0] === 'select');
    assert(select && !/user_id|admin_id|password_hash/.test(select[1]));
    assert.equal(userRes.body.ok, true);
    assert(!('user_id' in userRes.body.items[0]));
    assert(!('admin_id' in userRes.body.items[0]));
  });

  const startAccount = traces.length;
  const adminIdRes = response();
  await adminController.list({ query: { q: '1234567890', limit: '200' } }, adminIdRes);
  const userLookups = traces.slice(startAccount).filter((q) => q.table === 'users');
  const userLookup = userLookups.find((q) => q.calls.some((c) => c[0] === 'eq' && c[1] === 'account_id')) || userLookups[0];
  const adminTxQuery = lastTrace('transactions', startAccount);
  check('pencarian admin dengan ID akun membatasi query ke user target', () => {
    assert(userLookup.calls.some((c) => c[0] === 'eq' && c[1] === 'account_id' && c[2] === 1234567890));
    assert(adminTxQuery.calls.some((c) => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'target-user-id'));
  });
  check('limit riwayat admin dibatasi maksimal 50', () => {
    assert(adminTxQuery.calls.some((c) => c[0] === 'range' && c[2] === 49));
  });
  check('respons admin menghapus kolom pemilik dan identitas internal', () => {
    assert.equal(adminIdRes.body.ok, true);
    assert.equal(adminIdRes.body.items[0].account_id, 1234567890);
    assert(!('user_id' in adminIdRes.body.items[0]));
    assert(!('admin_id' in adminIdRes.body.items[0]));
  });

  const startName = traces.length;
  await adminController.list({ query: { q: 'target_user' } }, response());
  const nameLookup = traces.slice(startName).filter((q) => q.table === 'users').find((q) => q.calls.some((c) => c[0] === 'ilike' && c[1] === 'username'));
  const nameTx = lastTrace('transactions', startName);
  check('pencarian admin username menggunakan lookup user lalu filter user_id', () => {
    assert(nameLookup.calls.some((c) => c[0] === 'ilike' && c[1] === 'username'));
    assert(nameTx.calls.some((c) => c[0] === 'in' && c[1] === 'user_id'));
  });

  const startCode = traces.length;
  await adminController.list({ query: { q: 'TRX-20261112' } }, response());
  const codeQuery = lastTrace('transactions', startCode);
  check('pencarian kode transaksi tidak membangun filter SQL mentah', () => {
    assert(codeQuery.calls.some((c) => c[0] === 'ilike' && c[1] === 'transaction_code'));
  });
  check('karakter pencarian admin yang tidak diizinkan ditolak', () => {
    assert.throws(() => adminController._internal.parseSearch("%'; drop table"), /Gunakan username/);
  });

  process.stdout.write(`\nHasil PART 8 controller security test: ${passed} PASS, ${failed} FAIL\n`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('PART 8 test error:', err);
  process.exit(1);
});
