// Menjalankan seluruh API Express sebagai Netlify Function.
// Netlify meneruskan /api/* ke sini (lihat netlify.toml), path asli tetap /api/...
const serverless = require('serverless-http');
const app = require('../../backend/app');

// Di belakang CDN Netlify: percayai 1 proxy, lalu isi X-Forwarded-For dengan IP klien asli
// (supaya batas percobaan login tidak menganggap semua pengguna satu IP).
app.set('trust proxy', 1);

module.exports.handler = serverless(app, {
  request(req, event) {
    const h = (event && event.headers) || {};
    const ip =
      h['x-nf-client-connection-ip'] ||
      h['client-ip'] ||
      String(h['x-forwarded-for'] || '').split(',')[0].trim();
    if (ip) req.headers['x-forwarded-for'] = ip; // menimpa nilai kiriman klien -> tidak bisa dipalsukan
  },
});
