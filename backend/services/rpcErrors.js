const { HttpError } = require('./httpError');

// Kode exception yang dilempar fungsi RPC di schema.sql -> respons HTTP
const MAP = {
  USERNAME_TAKEN: [409, 'Username sudah digunakan.'],
  ID_GENERATION_FAILED: [503, 'Gagal membuat ID akun, coba lagi.'],
  INVALID_AMOUNT: [400, 'Nominal tidak valid.'],
  INVALID_REQUEST_KEY: [400, 'Permintaan pembelian tidak valid. Silakan coba lagi.'],
  PRODUCT_NOT_FOUND: [404, 'Produk tidak ditemukan atau sudah tidak tersedia.'],
  INSUFFICIENT_BALANCE: [409, 'Saldo tidak mencukupi untuk membeli produk ini. Silakan isi saldo terlebih dahulu.'],
  IDEMPOTENCY_KEY_REUSED: [409, 'Permintaan pembelian ini sudah digunakan untuk produk lain. Muat ulang halaman lalu coba lagi.'],
  USER_NOT_FOUND: [404, 'Akun tidak ditemukan.'],
  ADMIN_NOT_FOUND: [403, 'Admin tidak valid.'],
  WALLET_NOT_FOUND: [500, 'Dompet akun tidak ditemukan.'],
  REQUEST_NOT_CANCELLABLE: [409, 'Request tidak dapat dibatalkan (sudah diproses).'],
  REQUEST_NOT_PENDING: [409, 'Request sudah diproses sebelumnya.'],
  MESSAGE_NOT_FOUND: [404, 'Pesan tidak ditemukan.'],
  MESSAGE_CLAIM_REQUIRED: [409, 'Klaim saldo dari pesan ini terlebih dahulu sebelum menghapusnya.'],
  ALREADY_CLAIMED_OR_INVALID: [409, 'Saldo sudah diklaim atau permintaan tidak valid.'],
  ACCOUNT_ID_IMMUTABLE: [400, 'ID akun tidak dapat diubah.'],
};

// Mengubah error dari supabase.rpc(...) menjadi HttpError
function fromRpcError(error) {
  const key = String((error && error.message) || '').trim();
  if (MAP[key]) {
    return new HttpError(MAP[key][0], key, MAP[key][1]);
  }
  console.error('[RPC ERROR]', error);
  return new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.');
}

// Untuk error query biasa (select/insert) yang tidak diharapkan
function fromDbError(error) {
  console.error('[DB ERROR]', error);
  return new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.');
}

module.exports = { fromRpcError, fromDbError };
