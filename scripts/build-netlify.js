// Merakit folder dist/ untuk Netlify.
//   frontend/  -> akar situs        (https://situs/ , /login.html, ...)
//   admin/     -> /admin/           (https://situs/admin/index.html, ...)
// Halaman admin memakai /css/style.css, /js/app.js, /manifest.webmanifest, dll. dari akar,
// jadi keduanya harus berada dalam SATU folder publish.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'frontend'), dist, { recursive: true });
fs.cpSync(path.join(root, 'admin'), path.join(dist, 'admin'), { recursive: true });

const must = ['index.html', 'login.html', 'sw.js', 'css/style.css', 'js/app.js', 'admin/index.html', 'admin/login.html', 'admin/js/admin.js'];
const missing = must.filter((f) => !fs.existsSync(path.join(dist, f)));
if (missing.length) {
  console.error('[build] File penting tidak ditemukan di dist/: ' + missing.join(', '));
  process.exitCode = 1;
} else {
  console.log('[build] dist/ siap: situs di akar + halaman admin di /admin/');
}
