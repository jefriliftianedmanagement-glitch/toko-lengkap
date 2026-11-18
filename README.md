# Fake Online Shop PWA

Simulasi toko online dengan saldo virtual (tanpa uang sungguhan).
Stack: HTML/CSS/JS, Node.js + Express, Supabase (PostgreSQL + Storage).

## Status pengerjaan

- [x] PART 1 - Database (`database/schema.sql`)
- [x] PART 2 - Backend: registrasi, login, ID unik 10 digit, sesi
- [x] PART 3 - Frontend toko (login, register, dashboard, katalog produk)
- [x] PART 4 - Admin dashboard + produk (`database/part4.sql` wajib dijalankan)
- [x] PART 5 - Top-up request + admin inbox
- [x] PART 6 - User mailbox + claim balance
- [x] PART 7 - Admin send balance
- [x] PART 8 - Riwayat transaksi + security testing (smoke test diperluas; verifikasi live tetap perlu dijalankan)
- [x] PART 9 - PWA (manifest, install prompt, service worker, offline fallback)
- [x] PART 10 - Integrasi final (tes gabungan, pemeriksaan route/halaman, sintaks)

## Menjalankan secara lokal

Butuh Node.js 22 atau lebih baru (`node -v`), sesuai versi dependency Supabase yang dikunci di `package-lock.json`.

Buat file `.env` lokal secara manual (tidak disertakan di arsip), lalu isi
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `JWT_SECRET`. Jangan unggah atau commit file ini.

```bash
npm install
npm run create-admin        # buat akun admin pertama
npm run dev                 # server di http://localhost:3000
```

Buat `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Saat server menyala harus muncul `[SUPABASE] Koneksi database OK`.

## Pengujian otomatis dan keamanan

Uji validasi dan isolasi query PART 8 tanpa koneksi Supabase atau mutasi saldo/ledger:

```bash
npm run test:part8
```

Dengan server dan Supabase menyala, jalankan integration smoke test dari terminal kedua:

```bash
npm run smoke
```

Semua baris yang diuji harus `PASS`. Data uji memakai username berawalan `smoke_`. Smoke test mencakup auth/CSRF, pemisahan role admin, akses endpoint riwayat, dan validasi filter. Pengujian query isolasi pemilik transaksi tanpa menulis saldo/ledger dapat dijalankan kapan saja dengan `npm run test:part8`. Untuk mengaktifkan pengujian admin penuh, isi `SMOKE_ADMIN_USER` dan `SMOKE_ADMIN_PASS` dengan akun admin lokal Anda.
Untuk menghapusnya, jalankan di SQL Editor Supabase:

```sql
delete from public.user_inbox where user_id in (select id from public.users where username like 'smoke\_%');
delete from public.wallets    where user_id in (select id from public.users where username like 'smoke\_%');
delete from public.users      where username like 'smoke\_%';
```

## API (PART 2)

Semua request yang mengubah data wajib membawa header `X-Requested-With: fetch`
dan `Content-Type: application/json`. Sesi disimpan di cookie httpOnly.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET  | `/api/health` | Cek server dan database |
| POST | `/api/auth/register` | `{username, password}` -> buat akun + ID 10 digit |
| POST | `/api/auth/login` | `{username, password}` |
| POST | `/api/auth/logout` | Hapus sesi |
| GET  | `/api/auth/me` | Profil, saldo, jumlah pesan belum dibaca |
| POST | `/api/admin/auth/login` | Login admin (cookie terpisah) |
| POST | `/api/admin/auth/logout` | Logout admin |
| GET  | `/api/admin/auth/me` | Profil admin |

## API (PART 3)

Semua endpoint produk butuh login user.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/products` | Produk aktif. Query: `q`, `category`, `sort` (`newest`, `popular`, `cheapest`, `expensive`), `page`, `limit` (maks 48) |
| GET | `/api/products/categories` | Daftar kategori dari produk aktif |

Data contoh produk (opsional): jalankan `database/seed_products.sql` di SQL Editor Supabase.

## API (PART 4) - hanya untuk admin

Butuh login admin (cookie `admin_token`). Sesi user biasa selalu ditolak (401).

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/admin/dashboard` | Statistik + 10 transaksi terbaru |
| GET | `/api/admin/users` | Daftar pengguna. Query: `q` (username atau ID 10 digit), `page`, `limit` |
| GET | `/api/admin/products` | Semua produk. Query: `q`, `status` (`all`, `active`, `inactive`), `page`, `limit` |
| GET | `/api/admin/products/categories` | Semua kategori |
| POST | `/api/admin/products` | Buat produk `{name, price, category, description, is_active, image_path}` |
| PATCH | `/api/admin/products/:id` | Ubah sebagian field |
| DELETE | `/api/admin/products/:id` | Hapus produk + gambarnya |
| POST | `/api/admin/uploads/product-image` | Body = file mentah (`Content-Type: image/jpeg|png|webp`, maks 2 MB). Tipe diverifikasi dari isi file |

Upload gambar: browser mengecilkan gambar (maks 1200px, JPEG) lebih dulu, lalu server mengecek
magic bytes dan menyimpan dengan nama acak (UUID) di bucket `product-images`.
Setiap tambah/ubah/hapus produk tercatat di `admin_audit_log`.

Uji admin penuh dengan smoke test (Windows CMD):

```bat
set SMOKE_ADMIN_USER=username_admin_anda
set SMOKE_ADMIN_PASS=password_admin_anda
npm run smoke
```

## API (PART 5)

**Pengguna (wajib login):**

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/topups?page=&limit=` | Daftar permintaan top-up milik akun sendiri |
| POST | `/api/topups` | Ajukan nominal `{amount}`; saldo tidak berubah pada tahap ini |
| DELETE | `/api/topups/:id` | Batalkan permintaan yang masih `PENDING` |

**Admin (wajib login admin):**

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/admin/topups?status=PENDING&page=&limit=&q=` | Inbox top-up; status dapat `PENDING`, `APPROVED`, `REJECTED`, `CLAIMED`, `CANCELLED`, atau `all`. `q` mencari username/ID akun |
| POST | `/api/admin/topups/:id/approve` | Setujui permintaan; membuat pesan Inbox, saldo belum bertambah |
| POST | `/api/admin/topups/:id/reject` | Tolak permintaan dengan `{reason}` opsional (maks. 250 karakter) |

Pembuatan request top-up dibatasi 12 kali per jam per akun pengguna. Keputusan admin dilakukan melalui fungsi SQL transaksional yang hanya memproses status `PENDING`; audit log dan pesan pengguna dibuat di database.

## API (PART 7) - hanya untuk admin

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/admin/send-balance` | Kirim saldo virtual `{account_id, amount, note}` ke ID akun 10 digit; `note` opsional, maks. 250 karakter |

Pengiriman memakai fungsi SQL transaksional `admin_send_balance` yang sudah ada di `database/schema.sql`. Fungsi menambah wallet penerima, mencatat transaksi `ADMIN_SEND_BALANCE` dan wallet ledger, membuat pesan `BALANCE_RECEIVED`, serta menulis audit log dalam satu transaksi database. Saldo langsung bertambah setelah berhasil. Endpoint hanya menerima sesi admin dan dibatasi 30 pengiriman per jam per admin. Tidak diperlukan SQL migration tambahan apabila schema awal sudah dijalankan.

## PART 9 - Progressive Web App (PWA)

FakeShop dapat dipasang sebagai aplikasi melalui browser yang mendukung instalasi PWA. Fitur mencakup `manifest.webmanifest`, ikon 192/512 px termasuk maskable, tombol install saat browser menyediakan `beforeinstallprompt`, registrasi service worker pada HTTPS atau localhost, dan halaman offline fallback.

Service worker hanya menyimpan aset statis dan halaman offline. Request `/api/` serta halaman HTML yang dapat memuat data akun tidak disimpan ke cache. Saldo, sesi, Inbox, dan riwayat transaksi tetap membutuhkan koneksi server.

Uji aset dan konfigurasi PWA tanpa Supabase:

```bash
npm run test:pwa
```

PWA memerlukan HTTPS saat deployment publik. `http://localhost` dapat dipakai untuk pengembangan.

## PART 10 - Integrasi final

Jalankan pemeriksaan lokal gabungan berikut sebelum deploy:

```bash
npm test
```

Perintah ini memeriksa kelengkapan halaman user/admin, pemasangan route API, pemisahan folder statis frontend/admin, batas versi Node.js, sintaks seluruh file JavaScript, tes keamanan riwayat PART 8, tes aset/konfigurasi PWA PART 9, dan tes statis moderasi akun/riwayat PART 11. Tes ini tidak memerlukan `.env` atau koneksi Supabase.

Tes integrasi yang benar-benar mengakses database tetap dijalankan terpisah setelah `.env` lokal disiapkan dan Supabase tersedia:

```bash
npm run smoke
```

`npm test` yang lulus **bukan** pengganti tes login, transaksi, saldo, cookie HTTPS, atau pemasangan PWA pada domain produksi. Tes PWA di browser lokal dapat dimulai melalui `http://localhost:3000`; pemasangan pada perangkat publik dan perilaku service worker setelah deploy tetap perlu diverifikasi melalui HTTPS.

### Catatan hosting Netlify

Adapter Netlify sudah tersedia melalui `netlify/functions/api.js` dan `netlify.toml`. Build Netlify menjalankan `node scripts/build-netlify.js`, menyalin `frontend/` dan `admin/` ke `dist/`, serta meneruskan `/api/*` ke Netlify Function. Jangan mengubah `publish = "dist"`, konfigurasi redirect API, atau mengunggah `frontend/` saja.

Atur `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `JWT_SECRET` sebagai environment variables server-side untuk Functions di Netlify. Jangan menaruh service-role key atau JWT secret di frontend maupun repository. `NODE_VERSION` pada konfigurasi build disetel ke 22. Setelah deploy, periksa `/api/health` dan uji login, pembelian, riwayat, serta PWA pada domain HTTPS.

## PART 12 - Pembelian produk dengan saldo virtual

Halaman detail produk menyediakan tombol **Beli sekarang**. Pembelian harus dikonfirmasi dan hanya dapat dilakukan oleh user yang sedang login. Endpoint `POST /api/products/:id/purchase` mengambil identitas user dari cookie sesi server, sedangkan harga dan status aktif produk dibaca ulang dari database. Browser tidak dapat menentukan nominal potongan.

Jalankan `database/part12.sql` satu kali di Supabase SQL Editor setelah PART 11. RPC `purchase_product` mengunci data user, produk, dan wallet; memeriksa saldo; mengurangi saldo; membuat transaksi `PURCHASE`; menambahkan ledger `DEBIT`; dan menaikkan `sold_count` dalam satu transaksi database. Jika salah satu langkah gagal, seluruh perubahan dibatalkan. Kunci idempotensi membuat retry request yang sama tidak memotong saldo dua kali.

Setelah pembelian berhasil, header saldo diperbarui dan bukti transaksi menampilkan kode transaksi serta sisa saldo. Catatan pembelian muncul di halaman Riwayat dan daftar transaksi admin. Jika saldo tidak cukup atau produk sudah tidak aktif, pembelian ditolak tanpa mengubah saldo.

Tes lokal PART 12:

```bash
node scripts/product-purchase-test.js
npm test
```

Tes ini memeriksa route/controller, validasi UUID, pemakaian ID user dari sesi, aturan SQL atomik, dan perlindungan idempotensi tanpa koneksi Supabase. Tetap lakukan uji pembelian nominal kecil dengan akun dummy setelah menjalankan migration di Supabase.

## API (PART 12)

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/products/:id/purchase` | Membeli satu produk aktif dengan saldo virtual; body `{ "request_key": "UUID" }`; harga selalu dibaca dari database |

## API (PART 8)

**Riwayat pengguna (wajib login; hanya transaksi milik sesi sendiri):**

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/transactions?page=&limit=&type=&status=&from=&to=` | Riwayat transaksi akun sendiri; `type`: `all`, `TOPUP_CLAIM`, `ADMIN_SEND_BALANCE`, `PURCHASE`; `status`: `all`, `SUCCESS`, `FAILED`; tanggal memakai format `YYYY-MM-DD` |

**Riwayat admin (wajib login admin):**

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/admin/transactions?page=&limit=&q=&type=&status=&from=&to=` | Seluruh transaksi; `q` mencari username, ID akun 10 digit, atau kode `TRX-`; filter jenis/status/tanggal sama seperti endpoint pengguna |

Endpoint pengguna selalu menerapkan `user_id` dari sesi terverifikasi dan tidak menerima pemilihan pemilik transaksi dari browser. Endpoint admin memakai middleware `requireAdmin`. Keduanya mengembalikan pagination dan hanya field transaksi yang diperlukan untuk tampilan; tidak mengirim `user_id`, `admin_id`, atau data autentikasi. Filter jenis, status, tanggal, pagination, dan kata kunci divalidasi di backend. Tidak diperlukan SQL migration tambahan karena memakai tabel `transactions` yang sudah ada pada `database/schema.sql`.

## Halaman admin

Buka `http://localhost:3000/admin/login.html`. Halaman: Dashboard (`index.html`), Produk,
Pengguna. Inbox Top-up sudah aktif (PART 5). Send Balance sudah aktif (PART 7). Riwayat Transaksi sudah aktif (PART 8), termasuk pencarian, filter, dan pagination.

## Halaman frontend

`login.html`, `register.html`, `dashboard.html` (toko). `topup.html` sudah aktif untuk mengirim dan memantau permintaan top-up (PART 5). `mailbox.html` sudah aktif (PART 6) untuk membaca notifikasi, menandai pesan dibaca, dan klaim saldo top-up yang disetujui. `history.html` sudah aktif (PART 8) untuk melihat riwayat transaksi milik akun yang login.
Buka `http://localhost:3000` setelah server berjalan.

Contoh pemanggilan dari frontend:

```js
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
  body: JSON.stringify({ username, password }),
});
const data = await res.json(); // { ok: true, user: {...} } atau { ok: false, error: {code, message} }
```

## API (PART 6)

**Pengguna (wajib login):**

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/inbox?page=&limit=&filter=` | Pesan inbox akun sendiri; filter `all`, `unread`, atau `read`; respons juga memuat `unread_count` |
| POST | `/api/inbox/:id/read` | Tandai satu pesan sebagai sudah dibaca |
| POST | `/api/inbox/read-all` | Tandai semua pesan milik akun sendiri sebagai sudah dibaca |
| POST | `/api/inbox/:id/claim` | Klaim saldo dari pesan `TOPUP_APPROVED`; tidak menerima nominal dari browser |

Klaim menggunakan fungsi SQL transaksional `claim_topup` yang sudah ada di `database/schema.sql`. Fungsi memvalidasi kepemilikan pesan dan status permintaan, mencegah klaim ganda, menambahkan saldo, mencatat transaksi serta wallet ledger, lalu menandai pesan sebagai sudah diklaim/dibaca. Tidak diperlukan SQL migration tambahan untuk PART 6 apabila `database/schema.sql` awal sudah dijalankan.

## Keamanan yang sudah aktif

- PART 5: request hanya dapat dibaca/dibatalkan oleh pemiliknya; approval/rejection hanya oleh admin; nominal dan UUID divalidasi di backend; aksi approve/reject atomik dan tercatat di audit log.
- PART 6: inbox hanya menampilkan pesan pemilik sesi; aksi tandai dibaca dibatasi dengan `user_id`; klaim menggunakan RPC SQL dengan nominal dari database dan update status bersyarat untuk mencegah double-claim.
- PART 7: identitas admin berasal dari cookie sesi terverifikasi; ID akun harus 10 digit; nominal integer positif maksimal Rp1 triliun; RPC SQL mengerjakan saldo, transaksi, ledger, notifikasi, dan audit log secara atomik; batas 30 pengiriman per jam per admin.
- PART 8: endpoint riwayat user selalu membatasi data ke pemilik sesi; sesi user ditolak dari endpoint admin; filter dan tanggal divalidasi backend; unit test mock memeriksa isolasi query user/admin tanpa mengubah saldo atau append-only ledger.

- Password di-hash bcrypt (cost 12), batas 72 byte.
- Sesi JWT di cookie `httpOnly` + `SameSite=Strict` (+ `Secure` di production).
- Cookie user dan admin terpisah; admin berlaku 8 jam.
- Perlindungan CSRF: SameSite + cek Origin + header `X-Requested-With`.
- Rate limit: umum, per IP, dan per IP+username untuk login.
- Pesan login sama untuk "username salah" dan "password salah"; waktu respons disamakan.
- Helmet (CSP, dll.), batas body JSON 10 KB, `Cache-Control: no-store` pada API.
- `service_role` key hanya ada di `.env` backend.
- RLS aktif di semua tabel tanpa policy: key publik Supabase tidak bisa mengakses data.

## Deploy di belakang proxy / HTTPS

Isi `NODE_ENV=production` dan `TRUST_PROXY=1`. Cookie `Secure` hanya terkirim lewat HTTPS.


## PART 11 - moderasi akun dan pengelolaan riwayat

Jalankan migration SQL `database/part11.sql` satu kali di Supabase SQL Editor setelah migration/schema PART 10. Backup database sebelum menjalankannya.

- Admin dapat **Block / Unblock** akun. Block hanya menonaktifkan akses login/layanan; profil, wallet, inbox, transaksi, dan catatan saldo tidak dihapus. Status dapat dipulihkan dengan Unblock.
- Admin dapat **menghapus akun secara permanen**. Identitas akun dan akses login dihapus; wallet dan inbox ikut dihapus. Permintaan top-up dilepas dari profil, sementara transaksi dan wallet ledger dipertahankan sebagai catatan keuangan pseudonim tanpa profil user. Penghapusan akun tidak membalik atau menghapus pergerakan saldo historis.
- Pengguna dapat menghapus transaksi dari halaman riwayatnya sendiri. Tindakan ini hanya menyembunyikan transaksi dari akun tersebut; admin tetap dapat melihatnya.
- Admin dapat menghapus transaksi dari seluruh tampilan. Transaksi tidak lagi muncul di riwayat admin maupun user, tetapi baris transaksi dan wallet ledger tetap tersimpan untuk audit/integritas saldo.
- Pengguna dapat menghapus pesan Inbox miliknya. Pesan persetujuan top-up yang belum diklaim tidak dapat dihapus sampai saldo diklaim, agar tombol klaim tidak hilang.

**API tambahan:** `PATCH /api/admin/users/:id/status` (`{blocked: true|false}`), `DELETE /api/admin/users/:id`, `DELETE /api/transactions/:id`, `DELETE /api/admin/transactions/:id`, dan `DELETE /api/inbox/:id`. Semua endpoint memakai sesi terverifikasi dan pemeriksaan CSRF yang sudah aktif.

**Tes lokal:** `npm test` sekarang juga menjalankan pemeriksaan statis PART 11. Tes tersebut tidak terhubung ke Supabase. Setelah migration diterapkan pada project uji, lakukan pengujian manual block/unblock, hapus akun uji, hapus transaksi pada kedua halaman, dan hapus inbox. Jangan menguji penghapusan akun pada akun produksi sebelum backup dan verifikasi.
