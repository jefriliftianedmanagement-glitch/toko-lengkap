const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k] || !process.env[k].trim());

if (missing.length) {
  console.error('[ENV] Variabel belum diisi di file .env: ' + missing.join(', '));
  process.exit(1);
}
if (process.env.JWT_SECRET.trim().length < 32) {
  console.error('[ENV] JWT_SECRET minimal 32 karakter.');
  process.exit(1);
}

// Ambil hanya "https://xxxx.supabase.co" (buang path tambahan jika salah ketik)
let supabaseUrl;
try {
  supabaseUrl = new URL(process.env.SUPABASE_URL.trim().replace(/^["']|["']$/g, '')).origin;
} catch {
  console.error('[ENV] SUPABASE_URL tidak valid. Contoh: https://abcdefghijkl.supabase.co');
  process.exit(1);
}

const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  NODE_ENV,
  IS_PROD: NODE_ENV === 'production',
  PORT: Number(process.env.PORT) || 3000,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  JWT_SECRET: process.env.JWT_SECRET.trim(),
  USER_TOKEN_TTL_SEC: 7 * 24 * 3600, // 7 hari
  ADMIN_TOKEN_TTL_SEC: 8 * 3600, // 8 jam
  AUTH_RATE_MAX: Number(process.env.AUTH_RATE_MAX) || 20,
  TRUST_PROXY: process.env.TRUST_PROXY === '1',
};
