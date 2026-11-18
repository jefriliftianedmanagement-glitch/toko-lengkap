const supabase = require('../config/supabase');
const { fromRpcError, fromDbError } = require('../services/rpcErrors');
const { HttpError } = require('../services/httpError');
const { escapeLike } = require('../services/validators');
const { imageUrl } = require('../services/storage');

const COLUMNS = 'id, name, description, price, category, image_path, sold_count, created_at';

// Urutan: kolom utama + created_at sebagai pembeda, lalu id agar paginasi stabil
const SORTS = {
  newest: [['created_at', false]],
  popular: [['sold_count', false], ['created_at', false]],
  cheapest: [['price', true], ['created_at', false]],
  expensive: [['price', false], ['created_at', false]],
};

function clampInt(value, def, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function toPublic(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    category: p.category,
    image_url: imageUrl(p.image_path),
    sold_count: p.sold_count,
    created_at: p.created_at,
  };
}

// GET /api/products?q=&category=&sort=newest|popular|cheapest|expensive&page=&limit=
// Hanya produk aktif. Semua parameter divalidasi di sini.
async function list(req, res) {
  const page = clampInt(req.query.page, 1, 1, 10000);
  const limit = clampInt(req.query.limit, 12, 1, 48);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim().slice(0, 50) : '';
  const sort = Object.prototype.hasOwnProperty.call(SORTS, req.query.sort) ? req.query.sort : 'newest';

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('products').select(COLUMNS, { count: 'exact' }).eq('is_active', true);
  if (q) query = query.ilike('name', `%${escapeLike(q)}%`);
  if (category) query = query.eq('category', category);
  for (const [col, asc] of SORTS[sort]) query = query.order(col, { ascending: asc });
  query = query.order('id', { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw fromDbError(error);

  const total = count || 0;
  res.json({
    ok: true,
    items: (data || []).map(toPublic),
    page,
    limit,
    total,
    has_more: to + 1 < total,
  });
}

// GET /api/products/categories -> kategori dari produk aktif
async function categories(req, res) {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('is_active', true)
    .limit(2000);
  if (error) throw fromDbError(error);

  const list = [...new Set((data || []).map((r) => r.category))].sort((a, b) =>
    a.localeCompare(b, 'id')
  );
  res.json({ ok: true, categories: list });
}

// POST /api/products/:id/purchase - saldo hanya dipotong oleh RPC database atomik.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function purchase(req, res) {
  const productId = req.params.id;
  const requestKey = req.body && req.body.request_key;
  if (typeof productId !== 'string' || !UUID_RE.test(productId)) {
    throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Produk tidak ditemukan atau sudah tidak tersedia.');
  }
  if (typeof requestKey !== 'string' || !UUID_RE.test(requestKey)) {
    throw new HttpError(400, 'INVALID_REQUEST_KEY', 'Permintaan pembelian tidak valid. Silakan coba lagi.');
  }

  const { data, error } = await supabase.rpc('purchase_product', {
    p_user_id: req.user.id,
    p_product_id: productId,
    p_request_key: requestKey,
  });
  if (error) throw fromRpcError(error);
  res.json({ ok: true, purchase: data });
}

module.exports = { list, categories, purchase, _internal: { clampInt, imageUrl, UUID_RE } };
