const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const supabase = require('./config/supabase');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

if (env.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        // gambar produk dari Supabase Storage
        'img-src': ["'self'", 'data:', 'blob:', env.SUPABASE_URL],
        'connect-src': ["'self'"],
        // matikan upgrade-insecure-requests saat development (http://localhost)
        'upgrade-insecure-requests': env.IS_PROD ? [] : null,
      },
    },
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Respons API tidak boleh di-cache (berisi saldo, sesi, dll.)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', apiLimiter, routes);
app.use('/api', notFound);

// File statis: halaman admin dipisah dari halaman user
const root = path.resolve(__dirname, '..');
app.use('/admin', express.static(path.join(root, 'admin')));
app.use('/', express.static(path.join(root, 'frontend')));

app.use(errorHandler);

app.listen(env.PORT, async () => {
  console.log(`Server berjalan di http://localhost:${env.PORT}  (${env.NODE_ENV})`);
  const { error } = await supabase.from('admins').select('id', { count: 'exact', head: true });
  if (error) {
    console.error('[SUPABASE] Koneksi/tabel BERMASALAH:', error.message);
    console.error('           Periksa SUPABASE_URL, key, dan pastikan schema.sql sudah dijalankan.');
  } else {
    console.log('[SUPABASE] Koneksi database OK');
  }
});
