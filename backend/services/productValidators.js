const { HttpError } = require('./httpError');

const IMAGE_PATH_RE =
  /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PRICE = 1000000000000; // batas teknis (cegah overflow)

const bad = (msg) => new HttpError(400, 'INVALID_PRODUCT', msg);
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

function parsePrice(v) {
  let n;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d{1,13}$/.test(v.trim())) n = Number(v.trim());
  else throw bad('Harga harus berupa angka bulat.');
  if (!Number.isSafeInteger(n) || n <= 0) throw bad('Harga harus lebih dari 0 dan berupa angka bulat.');
  if (n > MAX_PRICE) throw bad('Harga terlalu besar.');
  return n;
}

// partial=false -> membuat produk (name & price wajib); partial=true -> edit sebagian field
function parseProductInput(body, partial) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Data produk tidak valid.');
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const out = {};

  if (!partial || has('name')) {
    if (typeof body.name !== 'string') throw bad('Nama produk wajib diisi.');
    const name = body.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 150) throw bad('Nama produk 2-150 karakter.');
    out.name = name;
  }

  if (!partial || has('price')) out.price = parsePrice(body.price);

  if (has('description')) {
    if (typeof body.description !== 'string') throw bad('Deskripsi tidak valid.');
    const d = body.description.trim();
    if (d.length > 2000) throw bad('Deskripsi maksimal 2000 karakter.');
    out.description = d;
  }

  if (has('category') || !partial) {
    const raw = has('category') ? body.category : 'Umum';
    if (typeof raw !== 'string') throw bad('Kategori tidak valid.');
    const c = raw.trim().replace(/\s+/g, ' ');
    if (c.length < 1 || c.length > 50) throw bad('Kategori 1-50 karakter.');
    out.category = c;
  }

  if (has('is_active')) {
    if (typeof body.is_active !== 'boolean') throw bad('Status produk tidak valid.');
    out.is_active = body.is_active;
  }

  if (has('image_path')) {
    const p = body.image_path;
    if (p === null || p === '') out.image_path = null;
    else if (typeof p === 'string' && IMAGE_PATH_RE.test(p)) out.image_path = p;
    else throw bad('Path gambar tidak valid.');
  }

  if (partial && Object.keys(out).length === 0) throw bad('Tidak ada perubahan yang dikirim.');
  return out;
}

// Deteksi tipe gambar dari ISI file (magic bytes), bukan dari header/ekstensi yang bisa dipalsukan
function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

module.exports = { parseProductInput, detectImageType, isUuid, IMAGE_PATH_RE };
