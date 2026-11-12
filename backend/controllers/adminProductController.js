const supabase = require('../config/supabase');
const { HttpError } = require('../services/httpError');
const { fromDbError } = require('../services/rpcErrors');
const { escapeLike } = require('../services/validators');
const { parseProductInput, detectImageType, isUuid } = require('../services/productValidators');
const { imageUrl, uploadImage, removeImage } = require('../services/storage');
const { logAdmin } = require('../services/audit');
const { clampInt } = require('./productController')._internal;

const COLUMNS = 'id, name, description, price, category, image_path, is_active, sold_count, created_at, updated_at';
const notFound = () => new HttpError(404, 'NOT_FOUND', 'Produk tidak ditemukan.');

function toAdmin(p) {
  return { ...p, image_url: imageUrl(p.image_path) };
}

// GET /api/admin/products?q=&status=all|active|inactive&page=&limit=
async function list(req, res) {
  const page = clampInt(req.query.page, 1, 1, 10000);
  const limit = clampInt(req.query.limit, 10, 1, 50);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const status = ['active', 'inactive'].includes(req.query.status) ? req.query.status : 'all';
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('products').select(COLUMNS, { count: 'exact' });
  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'inactive') query = query.eq('is_active', false);
  if (q) query = query.ilike('name', `%${escapeLike(q)}%`);
  query = query.order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw fromDbError(error);

  const total = count || 0;
  res.json({
    ok: true,
    items: (data || []).map(toAdmin),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

// GET /api/admin/products/categories -> semua kategori (termasuk produk nonaktif)
async function categories(req, res) {
  const { data, error } = await supabase.from('products').select('category').limit(2000);
  if (error) throw fromDbError(error);
  const list = [...new Set((data || []).map((r) => r.category))].sort((a, b) => a.localeCompare(b, 'id'));
  res.json({ ok: true, categories: list });
}

// POST /api/admin/products
async function create(req, res) {
  const input = parseProductInput(req.body, false);
  const row = { ...input, created_by: req.admin.id };

  const { data, error } = await supabase.from('products').insert(row).select(COLUMNS).single();
  if (error) throw fromDbError(error);

  await logAdmin(req.admin.id, 'CREATE_PRODUCT', data.id, { name: data.name, price: data.price });
  res.status(201).json({ ok: true, product: toAdmin(data) });
}

// PATCH /api/admin/products/:id  (boleh sebagian field)
async function update(req, res) {
  const id = req.params.id;
  if (!isUuid(id)) throw notFound();
  const input = parseProductInput(req.body, true);

  const { data: old, error: e1 } = await supabase
    .from('products')
    .select('id, image_path')
    .eq('id', id)
    .maybeSingle();
  if (e1) throw fromDbError(e1);
  if (!old) throw notFound();

  const { data, error } = await supabase.from('products').update(input).eq('id', id).select(COLUMNS).single();
  if (error) throw fromDbError(error);

  // gambar diganti/dihapus -> bersihkan file lama dari Storage
  if ('image_path' in input && old.image_path && old.image_path !== input.image_path) {
    await removeImage(old.image_path);
  }

  await logAdmin(req.admin.id, 'UPDATE_PRODUCT', id, { fields: Object.keys(input) });
  res.json({ ok: true, product: toAdmin(data) });
}

// DELETE /api/admin/products/:id
async function remove(req, res) {
  const id = req.params.id;
  if (!isUuid(id)) throw notFound();

  const { data: old, error: e1 } = await supabase
    .from('products')
    .select('id, name, image_path')
    .eq('id', id)
    .maybeSingle();
  if (e1) throw fromDbError(e1);
  if (!old) throw notFound();

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw fromDbError(error);

  await removeImage(old.image_path);
  await logAdmin(req.admin.id, 'DELETE_PRODUCT', id, { name: old.name });
  res.json({ ok: true });
}

// POST /api/admin/uploads/product-image  (body = file mentah, Content-Type image/jpeg|png|webp)
async function uploadProductImage(req, res) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA', 'Kirim file gambar JPG, PNG, atau WEBP.');
  }
  const type = detectImageType(req.body);
  if (!type) {
    throw new HttpError(400, 'INVALID_IMAGE', 'Isi file bukan gambar JPG, PNG, atau WEBP yang valid.');
  }
  const path = await uploadImage(req.body, type);
  res.status(201).json({ ok: true, image_path: path, image_url: imageUrl(path) });
}

module.exports = { list, categories, create, update, remove, uploadProductImage };
