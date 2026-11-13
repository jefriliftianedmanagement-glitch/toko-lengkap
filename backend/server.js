// Menjalankan server lokal / hosting Node biasa. (Di Netlify dipakai netlify/functions/api.js)
const env = require('./config/env');
const supabase = require('./config/supabase');
const app = require('./app');

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
