/* PART 12 purchase endpoint tests; no .env or live Supabase required. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const supabasePath = require.resolve('../backend/config/supabase');
const storagePath = require.resolve('../backend/services/storage');
const calls = [];
const fakeSupabase = {
  rpc(name, args) {
    calls.push({ name, args });
    return Promise.resolve({ data: {
      transaction_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      transaction_code: 'TRX-20261118-ABCDEF012345',
      amount: 25000,
      description: 'Pembelian produk: Produk Uji',
      balance_before: 50000,
      balance_after: 25000,
      already_processed: false,
    }, error: null });
  },
};
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: fakeSupabase };
require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: { imageUrl: (p) => p || null } };
const controller = require('../backend/controllers/productController');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

(async () => {
  const productId = '11111111-1111-4111-8111-111111111111';
  const requestKey = '22222222-2222-4222-8222-222222222222';
  const res = response();
  await controller.purchase({
    params: { id: productId },
    body: { request_key: requestKey, user_id: 'attacker-id', amount: 1 },
    user: { id: 'authenticated-user-id' },
  }, res);
  check('purchase RPC uses user id from verified session, not browser body', () => {
    assert.equal(calls[0].name, 'purchase_product');
    assert.equal(calls[0].args.p_user_id, 'authenticated-user-id');
    assert.notEqual(calls[0].args.p_user_id, 'attacker-id');
  });
  check('product id and idempotency key are passed as validated UUIDs', () => {
    assert.equal(calls[0].args.p_product_id, productId);
    assert.equal(calls[0].args.p_request_key, requestKey);
  });
  check('purchase response exposes only the RPC receipt', () => {
    assert.equal(res.body.ok, true);
    assert.equal(res.body.purchase.transaction_code, 'TRX-20261118-ABCDEF012345');
    assert.equal(res.body.purchase.balance_after, 25000);
    assert.equal(res.statusCode, 200);
  });

  check('invalid product UUID is rejected before the RPC', async () => {
    const before = calls.length;
    await assert.rejects(
      controller.purchase({ params: { id: 'not-a-uuid' }, body: { request_key: requestKey }, user: { id: 'u1' } }, response()),
      (error) => error.status === 404 && error.code === 'PRODUCT_NOT_FOUND'
    );
    assert.equal(calls.length, before);
  });
  check('invalid request key is rejected before the RPC', async () => {
    const before = calls.length;
    await assert.rejects(
      controller.purchase({ params: { id: productId }, body: { request_key: 'bad' }, user: { id: 'u1' } }, response()),
      (error) => error.status === 400 && error.code === 'INVALID_REQUEST_KEY'
    );
    assert.equal(calls.length, before);
  });

  check('SQL migration locks wallet/product and records debit, sale count and purchase atomically', () => {
    const sql = read('database/part12.sql');
    assert.match(sql, /for update[\s\S]*?public\.products/i);
    assert.match(sql, /from public\.wallets[\s\S]*?for update/i);
    assert.match(sql, /balance = balance - v_product\.price/i);
    assert.match(sql, /'DEBIT', v_product\.price, v_balance_before, v_balance_after/i);
    assert.match(sql, /sold_count = sold_count \+ 1/i);
    assert.match(sql, /grant execute on function public\.purchase_product\(uuid, uuid, uuid\) to service_role/i);
    assert.doesNotMatch(sql, /grant execute on function public\.purchase_product[\s\S]*?to public/i);
  });
  check('SQL migration has a unique idempotency key and duplicate retries do not debit again', () => {
    const sql = read('database/part12.sql');
    assert.match(sql, /create unique index if not exists transactions_purchase_idempotency_uidx/i);
    assert.match(sql, /pg_advisory_xact_lock/i);
    assert.match(sql, /already_processed', true/i);
    assert.match(sql, /idempotency_key = p_request_key/i);
  });
  check('frontend renders a real buy action and updates displayed balance after success', () => {
    const js = read('frontend/js/dashboard.js');
    assert.match(js, /label: 'Beli sekarang'/);
    assert.match(js, /\/purchase/);
    assert.match(js, /S\.setBalance\(receipt\.balance_after\)/);
    assert.match(js, /Konfirmasi pembelian/);
  });
  check('product purchase endpoint is registered behind user authentication', () => {
    const routes = read('backend/routes/products.js');
    assert.match(routes, /router\.post\('\/:id\/purchase',\s*requireUser,\s*ah\(c\.purchase\)\)/);
  });

  console.log(`\nPART 12 product purchase tests: ${passed} PASS, ${failed} FAIL`);
  process.exitCode = failed ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; });
