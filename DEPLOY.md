# Deploy FakeShop (gratis, tanpa kartu kredit): semuanya di Netlify

Susunan: halaman web (frontend + admin) disajikan Netlify sebagai file statis, backend Express berjalan
sebagai **Netlify Function**, dan data tetap di Supabase. Satu alamat untuk semuanya,
mis. `https://toko-lengkap.netlify.app`.

## Sekali saja: siapkan kode

1. Ekstrak patch ini ke folder proyek (menimpa beberapa file).
2. Di terminal folder proyek jalankan: `npm install`
   (menambahkan `serverless-http` dan memperbarui `package-lock.json`).
3. Uji lokal seperti biasa: `npm run dev` lalu buka `http://localhost:3000`.
4. `git add . && git commit -m "Netlify Functions" && git push`

## Pengaturan Netlify

1. **Site configuration -> Environment variables**, tambahkan:

   | Nama | Nilai |
   |---|---|
   | `SUPABASE_URL` | Project URL Supabase (`https://xxxx.supabase.co`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key (tandai sebagai secret) |
   | `JWT_SECRET` | string acak 32+ karakter (tandai sebagai secret) |
   | `NODE_ENV` | `production` |

2. **Site configuration -> Build & deploy -> Build settings**: kosongkan "Publish directory" jika sebelumnya
   diisi `frontend`. `netlify.toml` sudah mengatur build command, folder publish (`dist`), dan fungsi.
3. Deploy ulang (Deploys -> Trigger deploy), atau cukup `git push`.

## Cek setelah deploy

- `https://ALAMAT-ANDA.netlify.app/api/health` harus menampilkan `{"ok":true,"db":true}`
- `https://ALAMAT-ANDA.netlify.app/` -> daftar akun, login
- `https://ALAMAT-ANDA.netlify.app/admin/login.html` -> login admin
  (admin dibuat dengan `npm run create-admin` di komputer Anda; database Supabase-nya sama)

## Jika ada masalah

- **Build gagal dengan pesan "secrets scanning":** Netlify memindai isi situs untuk nilai environment variable.
  Tambahkan variabel `SECRETS_SCAN_OMIT_KEYS` = `SUPABASE_URL` (alamat Supabase memang bukan rahasia).
- **`/api/health` menampilkan error / 500:** buka Netlify -> Logs -> Functions -> `api`. Biasanya ada variabel
  environment yang belum diisi (`[ENV] Variabel belum diisi ...`).
- **`/api/health` 404:** pastikan folder `netlify/functions/api.js` ikut ter-push dan `netlify.toml` ada di akar repo.
- **Login berhasil tetapi langsung logout:** pastikan `NODE_ENV=production` dan Anda membuka lewat `https://`.

## Catatan

- Batas percobaan login (rate limit) berjalan per instance fungsi, jadi sifatnya "sebisanya" di lingkungan
  serverless; cukup untuk proyek simulasi ini, tetapi bukan perlindungan penuh terhadap serangan berat.
- Permintaan pertama setelah lama sepi bisa sedikit lebih lambat (fungsi perlu "bangun").
- Paket gratis Netlify punya batas pemakaian. Jika batas habis, situs dijeda sampai periode berikutnya atau
  Anda meningkatkan paket. Pantau di Netlify -> Usage & billing.
- Jangan menaruh `.env` atau `service_role` key di GitHub. Key itu hanya ada di pengaturan Netlify dan `.env` lokal.
