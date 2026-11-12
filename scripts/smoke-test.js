// Uji integrasi + keamanan PART 2-8 (auth, isolasi akun, role admin, dan transaksi).
// Jalankan server dulu (npm start), lalu di terminal lain: npm run smoke
const BASE = process.env.BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''));
  }
}

class Client {
  constructor() {
    this.cookies = new Map();
  }
  // Kirim file mentah (untuk uji upload gambar)
  async raw(path, buf, contentType) {
    const headers = { 'Content-Type': contentType, 'X-Requested-With': 'fetch' };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE + path, { method: 'POST', headers, body: buf });
    let json = null;
    try { json = await res.json(); } catch { /* kosong */ }
    return { status: res.status, json, raw: JSON.stringify(json) };
  }
  async req(method, path, body, { csrf = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (csrf) headers['X-Requested-With'] = 'fetch';
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const c of setCookies) {
      const pair = c.split(';')[0];
      const i = pair.indexOf('=');
      const k = pair.slice(0, i);
      const v = pair.slice(i + 1);
      if (v === '' || /expires=Thu, 01 Jan 1970/i.test(c)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* body kosong */
    }
    return { status: res.status, json, raw: JSON.stringify(json) };
  }
}

(async () => {
  const stamp = Date.now().toString(36); // 8 karakter
  const PASS = 'PasswordUji123';
  const nameA = `smoke_${stamp}_a`;
  const nameB = `smoke_${stamp}_b`;
  const A = new Client();
  const B = new Client();

  console.log('Target: ' + BASE + '\n');

  console.log('[Health]');
  const h = await new Client().req('GET', '/api/health');
  check('server + database terhubung', h.status === 200 && h.json && h.json.db === true,
        'status ' + h.status + ' (cek .env dan schema.sql)');
  if (h.status !== 200) {
    console.log('\nBerhenti: database belum terhubung.');
    process.exit(1);
  }

  console.log('\n[Registrasi]  TEST 1 & 2');
  const ra = await A.req('POST', '/api/auth/register', { username: '@' + nameA, password: PASS });
  check('akun A terdaftar (201)', ra.status === 201, ra.raw);
  const idA = ra.json && ra.json.user && ra.json.user.account_id;
  check('ID akun A berupa 10 digit', /^\d{10}$/.test(String(idA)), String(idA));

  const rb = await B.req('POST', '/api/auth/register', { username: nameB, password: PASS });
  check('akun B terdaftar (201)', rb.status === 201, rb.raw);
  const idB = rb.json && rb.json.user && rb.json.user.account_id;
  check('ID akun B berbeda dari A', idB && idA !== idB, `${idA} vs ${idB}`);

  const dup = await new Client().req('POST', '/api/auth/register', {
    username: nameA.toUpperCase(), password: PASS,
  });
  check('username kembar (beda huruf besar) ditolak 409', dup.status === 409, dup.raw);

  const badName = await new Client().req('POST', '/api/auth/register', { username: 'a b', password: PASS });
  check('username tidak valid ditolak 400', badName.status === 400, badName.raw);

  const weak = await new Client().req('POST', '/api/auth/register', { username: nameA + 'x', password: 'short' });
  check('password lemah ditolak 400', weak.status === 400, weak.raw);

  console.log('\n[Keamanan request]');
  const noCsrf = await new Client().req('POST', '/api/auth/login',
    { username: nameA, password: PASS }, { csrf: false });
  check('POST tanpa header CSRF ditolak 403', noCsrf.status === 403, noCsrf.raw);

  console.log('\n[Login]');
  const wrong = await new Client().req('POST', '/api/auth/login', { username: nameA, password: 'SalahBanget1' });
  const ghost = await new Client().req('POST', '/api/auth/login', { username: 'tidak_ada_' + stamp, password: 'SalahBanget1' });
  check('password salah -> 401', wrong.status === 401, wrong.raw);
  check('username tak ada -> 401 dengan pesan sama (anti enumerasi)',
        ghost.status === 401 && ghost.json.error.message === wrong.json.error.message);

  const A2 = new Client();
  const la = await A2.req('POST', '/api/auth/login', { username: nameA, password: PASS });
  check('login benar -> 200', la.status === 200, la.raw);
  check('respons tidak memuat password_hash', !/password/i.test(la.raw) && !/password/i.test(ra.raw));

  console.log('\n[Sesi & isolasi akun]');
  const meA = await A2.req('GET', '/api/auth/me');
  check('/me akun A: ID benar, saldo 0',
        meA.status === 200 && meA.json.user.account_id === idA && meA.json.user.balance === 0, meA.raw);
  check('/me akun A: ada 1 pesan welcome belum dibaca', meA.json && meA.json.user.unread_count === 1, meA.raw);
  const meB = await B.req('GET', '/api/auth/me');
  check('/me akun B menampilkan ID miliknya sendiri', meB.json && meB.json.user.account_id === idB, meB.raw);

  const noLogin = await new Client().req('GET', '/api/auth/me');
  check('/me tanpa login -> 401', noLogin.status === 401);

  console.log('\n[Riwayat transaksi]  (PART 8)');
  const noAuthTx = await new Client().req('GET', '/api/transactions');
  check('GET /transactions tanpa login -> 401', noAuthTx.status === 401, noAuthTx.raw);
  const txA = await A2.req('GET', '/api/transactions?page=1&limit=5');
  check('user A dapat membaca riwayatnya sendiri', txA.status === 200 && Array.isArray(txA.json.items) && typeof txA.json.total === 'number', txA.raw);
  check('respons riwayat user tidak membocorkan user_id/admin_id', txA.json && txA.json.items.every((t) => !('user_id' in t) && !('admin_id' in t)));
  const badTxType = await A2.req('GET', '/api/transactions?type=TRANSFER_BEBAS');
  check('filter jenis transaksi tidak dikenal ditolak 400', badTxType.status === 400, badTxType.raw);
  const badTxDate = await A2.req('GET', '/api/transactions?from=2026-02-31');
  check('tanggal tidak valid ditolak 400', badTxDate.status === 400, badTxDate.raw);
  const badTxRange = await A2.req('GET', '/api/transactions?from=2026-11-10&to=2026-11-01');
  check('rentang tanggal terbalik ditolak 400', badTxRange.status === 400, badTxRange.raw);
  const spoofTx = await A2.req('GET', '/api/transactions?user_id=' + encodeURIComponent('akun-lain'));
  check('parameter user_id dari browser tidak mengubah cakupan akun', spoofTx.status === 200 && (spoofTx.json.items || []).every((t) => !('user_id' in t)), spoofTx.raw);

  console.log('\n[Pemisahan admin]  TEST 10 (bagian auth)');
  const adminWithUser = await A2.req('GET', '/api/admin/auth/me');
  check('sesi user tidak bisa masuk endpoint admin (401)', adminWithUser.status === 401, adminWithUser.raw);
  const adminLogin = await new Client().req('POST', '/api/admin/auth/login',
    { username: nameA, password: PASS });
  check('akun user tidak bisa login sebagai admin (401)', adminLogin.status === 401, adminLogin.raw);

  console.log('\n[Produk]  (PART 3)');
  const noAuthProd = await new Client().req('GET', '/api/products');
  check('GET /products tanpa login -> 401', noAuthProd.status === 401);
  const pl = await A2.req('GET', '/api/products?page=1&limit=5&sort=cheapest');
  check('daftar produk 200 + struktur benar',
        pl.status === 200 && Array.isArray(pl.json.items) && typeof pl.json.total === 'number' &&
        typeof pl.json.has_more === 'boolean', pl.raw);
  const items = (pl.json && pl.json.items) || [];
  check('limit dihormati (maks 5)', items.length <= 5);
  const prices = items.map((p) => p.price);
  check('urutan termurah menaik', prices.every((v, i) => i === 0 || prices[i - 1] <= v), prices.join(','));
  check('kolom internal tidak bocor (created_by, is_active, image_path)',
        items.every((p) => !('created_by' in p) && !('is_active' in p) && !('image_path' in p)));
  const weird = await A2.req('GET', '/api/products?q=%25_%5C%27&sort=hack&limit=9999&page=-3');
  check('input aneh (%, _, \\, sort liar) tidak membuat error', weird.status === 200, weird.raw);
  check('limit dibatasi maksimal 48', weird.json && weird.json.limit <= 48 && weird.json.page === 1);
  const cats = await A2.req('GET', '/api/products/categories');
  check('daftar kategori 200', cats.status === 200 && Array.isArray(cats.json.categories), cats.raw);

  console.log('\n[Akses admin oleh user biasa]  TEST 10  (PART 4)');
  for (const [m, p, b] of [
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/products'],
    ['GET', '/api/admin/users'],
    ['GET', '/api/admin/transactions'],
    ['POST', '/api/admin/products', { name: 'Produk Ilegal', price: 1000 }],
  ]) {
    const r = await A2.req(m, p, b);
    check(`sesi user ditolak: ${m} ${p} -> 401`, r.status === 401, 'status ' + r.status);
  }
  const anonUp = await new Client().raw('/api/admin/uploads/product-image', Buffer.from('x'), 'image/png');
  check('upload tanpa login admin ditolak (401)', anonUp.status === 401, anonUp.raw);

  console.log('\n[Admin penuh]  (PART 4)');
  const AU = process.env.SMOKE_ADMIN_USER;
  const AP = process.env.SMOKE_ADMIN_PASS;
  if (!AU || !AP) {
    console.log('  SKIP  isi SMOKE_ADMIN_USER dan SMOKE_ADMIN_PASS untuk mengaktifkan uji admin penuh');
  } else {
    const AD = new Client();
    const al = await AD.req('POST', '/api/admin/auth/login', { username: AU, password: AP });
    check('login admin berhasil', al.status === 200, al.raw);
    if (al.status === 200) {
      const d = await AD.req('GET', '/api/admin/dashboard');
      check('dashboard: statistik lengkap + transaksi terbaru',
            d.status === 200 && typeof d.json.stats.total_users === 'number' && Array.isArray(d.json.recent), d.raw);

      console.log('\n[Keamanan dan riwayat transaksi]');
      const ownHistory = await A2.req('GET', '/api/transactions?limit=5');
      check('user dapat membuka endpoint riwayat miliknya',
        ownHistory.status === 200 && Array.isArray(ownHistory.json.items), ownHistory.raw);
      const adminHistory = await AD.req('GET', '/api/admin/transactions?q=' + encodeURIComponent(String(idA)) + '&limit=5');
      check('admin dapat mencari riwayat menggunakan ID akun',
        adminHistory.status === 200 && Array.isArray(adminHistory.json.items), adminHistory.raw);
      check('respons riwayat admin tidak memuat data password/internal',
        adminHistory.json && !/password_hash|service_role|user_id|admin_id/i.test(adminHistory.raw));
      const badAdminSearch = await AD.req('GET', '/api/admin/transactions?q=%25%27%3Bdrop%20table');
      check('kata kunci admin tidak valid ditolak 400', badAdminSearch.status === 400, badAdminSearch.raw);
      const adminAllHistory = await AD.req('GET', '/api/admin/transactions?type=all&status=all&page=1&limit=5');
      check('daftar semua transaksi admin punya pagination valid',
        adminAllHistory.status === 200 && Array.isArray(adminAllHistory.json.items) && adminAllHistory.json.limit <= 50, adminAllHistory.raw);

      const bad1 = await AD.req('POST', '/api/admin/products', { name: 'a', price: -5 });
      check('produk tidak valid ditolak 400', bad1.status === 400, bad1.raw);
      const bad2 = await AD.req('POST', '/api/admin/products', { name: 'Produk Uji', price: 1000, image_path: '../../etc/passwd' });
      check('image_path berbahaya ditolak 400', bad2.status === 400, bad2.raw);
      const notFound = await AD.req('PATCH', '/api/admin/products/bukan-uuid', { is_active: false });
      check('id produk bukan UUID -> 404', notFound.status === 404, notFound.raw);

      const fake = await AD.raw('/api/admin/uploads/product-image', Buffer.from('ini bukan gambar sungguhan'), 'image/png');
      check('file palsu berlabel PNG ditolak 400', fake.status === 400, fake.raw);
      const wrongType = await AD.raw('/api/admin/uploads/product-image', Buffer.from('abc'), 'text/plain');
      check('tipe selain gambar ditolak 415', wrongType.status === 415, wrongType.raw);

      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
      const up = await AD.raw('/api/admin/uploads/product-image', png, 'image/png');
      check('upload PNG valid -> 201', up.status === 201 && !!(up.json && up.json.image_path), up.raw);
      if (up.status === 201) {
        const img = await fetch(up.json.image_url);
        check('gambar dapat dibuka publik dari Supabase Storage', img.status === 200, 'status ' + img.status);
      }

      const pname = `Produk Uji ${stamp}`;
      const pc = await AD.req('POST', '/api/admin/products', {
        name: pname, price: 12345, category: 'Uji', description: 'dibuat oleh smoke test',
        image_path: up.json && up.json.image_path ? up.json.image_path : null,
      });
      check('buat produk -> 201', pc.status === 201 && pc.json.product.price === 12345, pc.raw);
      const pid = pc.json && pc.json.product && pc.json.product.id;

      if (pid) {
        const seen = await A2.req('GET', '/api/products?q=' + encodeURIComponent(pname));
        check('produk aktif tampil di toko user', seen.json && seen.json.items.some((p) => p.id === pid), seen.raw);

        const off = await AD.req('PATCH', '/api/admin/products/' + pid, { is_active: false });
        check('nonaktifkan produk -> 200', off.status === 200 && off.json.product.is_active === false, off.raw);
        const hidden = await A2.req('GET', '/api/products?q=' + encodeURIComponent(pname));
        check('produk nonaktif TIDAK tampil di toko user', hidden.json && !hidden.json.items.some((p) => p.id === pid), hidden.raw);

        const edit = await AD.req('PATCH', '/api/admin/products/' + pid, { price: 54321, is_active: true });
        check('edit harga + aktifkan lagi', edit.status === 200 && edit.json.product.price === 54321, edit.raw);

        const del = await AD.req('DELETE', '/api/admin/products/' + pid);
        check('hapus produk -> 200', del.status === 200, del.raw);
        const del2 = await AD.req('DELETE', '/api/admin/products/' + pid);
        check('hapus lagi -> 404', del2.status === 404, del2.raw);
      }

      const ul = await AD.req('GET', '/api/admin/users?q=' + idA);
      check('cari pengguna lewat ID akun 10 digit', ul.status === 200 && ul.json.items.length === 1 && ul.json.items[0].username === nameA, ul.raw);
      check('daftar pengguna tidak membocorkan password_hash', ul.json && !/password/i.test(ul.raw));
    }
  }

  console.log('\n[Logout]');
  await A2.req('POST', '/api/auth/logout');
  const afterLogout = await A2.req('GET', '/api/auth/me');
  check('setelah logout /me -> 401', afterLogout.status === 401);

  console.log('\n[Balapan]  TEST 9 (bagian registrasi): 6 registrasi bersamaan');
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      new Client().req('POST', '/api/auth/register', { username: `smoke_${stamp}_p${i}`, password: PASS })
    )
  );
  const ids = results.map((r) => r.json && r.json.user && r.json.user.account_id).filter(Boolean);
  check('6 akun terbuat semua', ids.length === 6, results.map((r) => r.status).join(','));
  check('6 ID akun semuanya unik', new Set(ids).size === ids.length);

  console.log(`\nHasil: ${passed} lulus, ${failed} gagal`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('Smoke test error:', e.message);
  console.error('Pastikan server sudah berjalan (npm start).');
  process.exit(1);
});
