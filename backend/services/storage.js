const crypto = require('crypto');
const supabase = require('../config/supabase');
const env = require('../config/env');
const { HttpError } = require('./httpError');

const BUCKET = 'product-images';

function imageUrl(path) {
  if (!path) return null;
  const encoded = String(path).split('/').map(encodeURIComponent).join('/');
  return `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

// Nama file dibuat server (UUID acak), tidak pernah memakai nama dari pengguna
async function uploadImage(buffer, type) {
  const path = `products/${crypto.randomUUID()}.${type.ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: type.mime,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) {
    console.error('[STORAGE] upload gagal:', error.message || error);
    throw new HttpError(502, 'UPLOAD_FAILED', 'Gagal menyimpan gambar. Pastikan bucket "product-images" ada di Supabase Storage.');
  }
  return path;
}

// Hapus file lama; kegagalan hanya dicatat (tidak membatalkan operasi utama)
async function removeImage(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error('[STORAGE] hapus gagal:', error.message || error);
}

module.exports = { BUCKET, imageUrl, uploadImage, removeImage };
