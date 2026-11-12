const { HttpError } = require('./httpError');

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const ADMIN_USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const BCRYPT_MAX_BYTES = 72;

// Menerima "@saya" atau "saya" -> "saya"
function parseUsername(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_USERNAME', 'Username wajib diisi.');
  }
  let s = value.trim();
  if (s.startsWith('@')) s = s.slice(1);
  if (!USERNAME_RE.test(s)) {
    throw new HttpError(
      400,
      'INVALID_USERNAME',
      'Username 3-20 karakter, hanya huruf, angka, dan underscore.'
    );
  }
  return s;
}

function parseAdminUsername(value) {
  if (typeof value !== 'string' || !ADMIN_USERNAME_RE.test(value.trim())) {
    throw new HttpError(400, 'INVALID_USERNAME', 'Username admin tidak valid.');
  }
  return value.trim();
}

// Untuk REGISTRASI: aturan kekuatan password
function parseNewPassword(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Password wajib diisi.');
  }
  if (value.length < 8) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Password minimal 8 karakter.');
  }
  if (Buffer.byteLength(value, 'utf8') > BCRYPT_MAX_BYTES) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Password terlalu panjang (maks 72 byte).');
  }
  return value;
}

// Untuk LOGIN: tidak membocorkan aturan, cukup tolak yang jelas mustahil
function parseLoginPassword(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Password wajib diisi.');
  }
  if (Buffer.byteLength(value, 'utf8') > BCRYPT_MAX_BYTES) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Username atau password salah.');
  }
  return value;
}

// Escape karakter spesial LIKE agar "_" pada username tidak jadi wildcard
function escapeLike(s) {
  return s.replace(/[\\%_]/g, '\\$&');
}

module.exports = {
  parseUsername,
  parseAdminUsername,
  parseNewPassword,
  parseLoginPassword,
  escapeLike,
};
