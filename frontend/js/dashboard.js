/* dashboard.js - halaman toko: pencarian, filter, grid produk, infinite scroll, detail produk */
(function () {
  'use strict';
  var S = window.Shop;
  var el = S.el, api = S.api, rupiah = S.rupiah;

  var grid = document.getElementById('grid');
  var stateBox = document.getElementById('stateBox');
  var sentinel = document.getElementById('sentinel');
  var resultInfo = document.getElementById('resultInfo');
  var chipsBox = document.getElementById('categoryChips');
  var sortGroup = document.getElementById('sortGroup');
  var loadMoreWrap = document.getElementById('loadMoreWrap');
  var loadMoreBtn = document.getElementById('loadMore');
  var purchaseRequestKeys = Object.create(null);

  var PAGE_SIZE = 12;
  var state = {
    q: (new URLSearchParams(location.search).get('q') || '').slice(0, 100),
    category: '',
    sort: 'newest',
    page: 0,
    hasMore: true,
    loading: false,
    total: 0,
    reqId: 0
  };

  // ---------------------------------------------------------- komponen
  function placeholder(name) {
    return el('div', 'ph', (name || '?').trim().charAt(0).toUpperCase());
  }
  function media(p, cls) {
    var wrap = el('div', cls);
    if (p.image_url) {
      var img = new Image();
      img.alt = p.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = p.image_url;
      img.addEventListener('error', function () { img.replaceWith(placeholder(p.name)); });
      wrap.append(img);
    } else {
      wrap.append(placeholder(p.name));
    }
    return wrap;
  }

  function card(p) {
    var a = el('article', 'card');
    a.tabIndex = 0;
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', 'Lihat produk ' + p.name);

    var body = el('div', 'card-body');
    body.append(el('span', 'tag', p.category));
    body.append(el('h3', 'card-name', p.name));
    body.append(el('p', 'card-desc', p.description || 'Belum ada deskripsi.'));

    var foot = el('div', 'card-foot');
    var left = el('div');
    left.append(el('strong', 'price', rupiah(p.price)));
    if (p.sold_count > 0) {
      left.append(document.createElement('br'));
      left.append(el('span', 'sold', 'Terjual ' + p.sold_count.toLocaleString('id-ID')));
    }
    foot.append(left, el('span', 'btn btn-sm btn-primary', 'Lihat produk'));
    body.append(foot);

    a.append(media(p, 'card-media'), body);
    a.addEventListener('click', function () { openDetail(p); });
    a.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(p); }
    });
    return a;
  }

  function skeleton() {
    var s = el('div', 'card skeleton-card');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML =
      '<div class="sk sk-media"></div><div class="card-body">' +
      '<div class="sk sk-line w40"></div><div class="sk sk-line"></div>' +
      '<div class="sk sk-line w70"></div><div class="sk sk-line w50"></div></div>';
    return s;
  }
  function showSkeletons(n) { for (var i = 0; i < n; i++) grid.append(skeleton()); }
  function removeSkeletons() { grid.querySelectorAll('.skeleton-card').forEach(function (n) { n.remove(); }); }

  function purchaseRequestKey(p) {
    if (purchaseRequestKeys[p.id]) return purchaseRequestKeys[p.id];
    var cryptoApi = window.crypto;
    if (!cryptoApi || !cryptoApi.getRandomValues) throw new Error('Browser tidak mendukung keamanan transaksi. Perbarui browser Anda.');
    if (cryptoApi.randomUUID) {
      purchaseRequestKeys[p.id] = cryptoApi.randomUUID();
      return purchaseRequestKeys[p.id];
    }
    var bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    purchaseRequestKeys[p.id] = hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    return purchaseRequestKeys[p.id];
  }

  async function purchaseProduct(p, modal) {
    if (modal.purchaseBusy) return;
    modal.purchaseBusy = true;
    var buyButton = modal.el.querySelector('.modal-foot .btn-primary');
    if (buyButton) buyButton.disabled = true;

    var confirmed = false;
    try {
      confirmed = await S.confirmDialog({
        title: 'Konfirmasi pembelian?',
        message: 'Beli "' + p.name + '" seharga ' + rupiah(p.price) + '? Nominal ini akan langsung dipotong dari saldo virtual Anda.',
        confirmText: 'Ya, beli sekarang'
      });
      if (!confirmed) return;

      if (buyButton) buyButton.textContent = 'Memproses...';
      var result = await api('/products/' + encodeURIComponent(p.id) + '/purchase', {
        method: 'POST',
        body: { request_key: purchaseRequestKey(p) }
      });
      var receipt = result.purchase;
      S.setBalance(receipt.balance_after);
      delete purchaseRequestKeys[p.id];
      modal.close();

      var successBody = el('div', 'purchase-success');
      successBody.append(
        el('div', 'purchase-success-icon', '✓'),
        el('h3', '', 'Pembelian berhasil!'),
        el('p', '', p.name),
        el('strong', 'purchase-success-price', rupiah(receipt.amount)),
        el('div', 'purchase-success-meta', 'Kode transaksi: ' + receipt.transaction_code),
        el('div', 'purchase-success-meta', 'Sisa saldo: ' + rupiah(receipt.balance_after)),
        el('p', 'purchase-success-note', 'Pembayaran simulasi menggunakan saldo virtual FakeShop. Tidak ada uang sungguhan yang diproses.')
      );
      S.openModal({
        title: 'Bukti pembelian',
        body: successBody,
        actions: [
          { label: 'Lihat riwayat', className: 'btn-primary', onClick: function () { location.href = 'history.html'; } },
          { label: 'Selesai', className: 'btn-ghost' }
        ]
      });
    } catch (err) {
      S.toast(err.message || 'Pembelian gagal diproses.', 'error', 5000);
    } finally {
      if (!modal.el || modal.el.isConnected) {
        modal.purchaseBusy = false;
        if (buyButton && buyButton.isConnected) {
          buyButton.disabled = false;
          buyButton.textContent = 'Beli sekarang';
        }
      }
    }
  }

  function openDetail(p) {
    var body = el('div');
    body.append(media(p, 'detail-media'));
    body.append(el('span', 'tag', p.category));
    body.append(el('div', 'detail-price', rupiah(p.price)));

    var meta = [];
    if (p.sold_count > 0) meta.push('Terjual ' + p.sold_count.toLocaleString('id-ID'));
    var d = new Date(p.created_at);
    if (!isNaN(d)) meta.push('Ditambahkan ' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }));
    body.append(el('div', 'detail-meta', meta.join(' • ')));
    body.append(el('p', 'detail-desc', p.description || 'Belum ada deskripsi untuk produk ini.'));

    var balance = Number(S.user && S.user.balance) || 0;
    var purchaseSummary = el('div', 'detail-purchase-summary');
    purchaseSummary.append(
      el('span', '', 'Saldo virtual Anda'),
      el('strong', '', rupiah(balance))
    );
    body.append(purchaseSummary);
    body.append(el('p', 'detail-purchase-hint', 'Pembelian akan memotong saldo virtual dan otomatis masuk ke riwayat transaksi. Tidak ada uang sungguhan yang digunakan.'));
    if (balance < Number(p.price)) {
      var topupLink = el('a', 'btn btn-ghost btn-block detail-topup-link', 'Saldo kurang? Isi saldo');
      topupLink.href = 'topup.html';
      body.append(topupLink);
    }

    S.openModal({
      title: p.name,
      body: body,
      actions: [
        { label: 'Beli sekarang', className: 'btn-primary', onClick: function (modal) { purchaseProduct(p, modal); } },
        { label: 'Tutup', className: 'btn-ghost' }
      ]
    });
  }

  // ----------------------------------------------------- status tampilan
  function clearState() { stateBox.replaceChildren(); }
  function showState(cfg) {
    clearState();
    var box = el('div', 'state-box');
    var ic = el('div', 'state-icon' + (cfg.error ? ' error' : ''));
    ic.innerHTML = S.icon(cfg.icon, 32);
    box.append(ic, el('h2', '', cfg.title), el('p', '', cfg.text));
    if (cfg.label) {
      var b = el('button', 'btn ' + (cfg.error ? 'btn-primary' : 'btn-ghost'), cfg.label);
      b.type = 'button';
      b.addEventListener('click', cfg.onClick);
      box.append(b);
    }
    stateBox.append(box);
  }

  function updateInfo() {
    var t = state.total.toLocaleString('id-ID') + ' produk';
    if (state.q) t += ' untuk "' + state.q + '"';
    if (state.category) t += ' di ' + state.category;
    resultInfo.textContent = t;
  }

  function resetFilters() {
    state.q = '';
    state.category = '';
    var input = document.getElementById('searchInput');
    if (input) input.value = '';
    renderChips(state.categories || []);
    load(true);
  }

  // ------------------------------------------------------------ memuat data
  async function load(reset) {
    if (state.loading && !reset) return;
    if (reset) {
      state.page = 0;
      state.hasMore = true;
      grid.replaceChildren();
      clearState();
      resultInfo.textContent = '';
    }
    if (!state.hasMore) return;

    var myReq = ++state.reqId; // abaikan respons usang jika filter berubah cepat
    state.loading = true;
    loadMoreWrap.hidden = true;
    showSkeletons(reset ? 8 : 4);

    try {
      var qs = new URLSearchParams({ page: String(state.page + 1), limit: String(PAGE_SIZE), sort: state.sort });
      if (state.q) qs.set('q', state.q);
      if (state.category) qs.set('category', state.category);
      var data = await api('/products?' + qs.toString());
      if (myReq !== state.reqId) return;

      removeSkeletons();
      state.page = data.page;
      state.hasMore = data.has_more;
      state.total = data.total;
      data.items.forEach(function (p) { grid.append(card(p)); });
      updateInfo();

      if (state.total === 0) {
        if (state.q || state.category) {
          showState({
            icon: 'searchX', title: 'Produk tidak ditemukan',
            text: 'Coba kata kunci lain atau hapus filter yang sedang aktif.',
            label: 'Hapus filter', onClick: resetFilters
          });
        } else {
          showState({ icon: 'box', title: 'Belum ada produk', text: 'Toko masih kosong. Produk akan muncul setelah admin menambahkannya.' });
        }
      }
    } catch (e) {
      if (myReq !== state.reqId) return;
      removeSkeletons();
      showState({
        error: true, icon: 'alert', title: 'Gagal memuat produk', text: e.message,
        label: 'Coba lagi', onClick: function () { load(state.page === 0); }
      });
    } finally {
      if (myReq === state.reqId) {
        state.loading = false;
        loadMoreWrap.hidden = !(state.hasMore && !('IntersectionObserver' in window) && state.total > 0);
      }
    }
  }

  // --------------------------------------------------------- kategori & urutan
  function renderChips(list) {
    chipsBox.replaceChildren();
    ['', ].concat(list).forEach(function (c) {
      var b = el('button', 'chip-btn', c === '' ? 'Semua' : c);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.category === c));
      b.addEventListener('click', function () {
        if (state.category === c) return;
        state.category = c;
        chipsBox.querySelectorAll('.chip-btn').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        load(true);
      });
      chipsBox.append(b);
    });
  }

  async function loadCategories() {
    try {
      var data = await api('/products/categories');
      state.categories = data.categories;
      renderChips(data.categories);
    } catch (e) {
      renderChips([]); // cukup tampilkan "Semua"
    }
  }

  sortGroup.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sort]');
    if (!b || b.getAttribute('data-sort') === state.sort) return;
    state.sort = b.getAttribute('data-sort');
    sortGroup.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    load(true);
  });

  document.addEventListener('shop:search', function (e) {
    var q = e.detail.q;
    if (q === state.q) return;
    state.q = q;
    load(true);
  });

  loadMoreBtn.addEventListener('click', function () { load(false); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && state.hasMore && !state.loading && state.page > 0) load(false);
    }, { rootMargin: '500px 0px' }).observe(sentinel);
  }

  // -------------------------------------------------------------- mulai
  (async function start() {
    var me = await S.initShell('dashboard');
    if (!me) return;
    loadCategories();
    load(true);
  })();
})();
