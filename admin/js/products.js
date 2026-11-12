/* products.js (admin) - daftar, tambah, edit, aktif/nonaktif, hapus produk + upload gambar */
(function () {
  'use strict';
  var S = window.Shop, A = window.Admin, el = S.el, api = S.api;

  var listBox = document.getElementById('plist');
  var pagerBox = document.getElementById('pager');
  var searchInput = document.getElementById('q');
  var statusGroup = document.getElementById('statusGroup');
  var addBtn = document.getElementById('addBtn');

  var state = { q: '', status: 'all', page: 1, limit: 10, reqId: 0, categories: [] };

  // ------------------------------------------------------------ gambar
  // Gambar dikecilkan di browser (maks 1200px, JPEG) supaya upload cepat dan di bawah 2 MB.
  function processImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Format gambar harus JPG, PNG, atau WEBP.'));
      if (file.size > 15 * 1024 * 1024) return reject(new Error('Ukuran gambar maksimal 15 MB.'));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var max = 1200;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; // PNG transparan -> latar putih
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob(function (blob) {
          if (!blob) return reject(new Error('Gagal memproses gambar.'));
          if (blob.size > 2 * 1024 * 1024 - 1024) return reject(new Error('Gambar masih terlalu besar setelah dikecilkan. Pilih gambar lain.'));
          resolve(blob);
        }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('File bukan gambar yang valid.')); };
      img.src = url;
    });
  }

  function thumb(p) {
    var t = el('div', 'thumb');
    if (p.image_url) {
      var img = new Image();
      img.alt = '';
      img.loading = 'lazy';
      img.src = p.image_url;
      img.addEventListener('error', function () { img.replaceWith(el('div', 'ph', p.name.charAt(0).toUpperCase())); });
      t.append(img);
    } else {
      t.append(el('div', 'ph', p.name.charAt(0).toUpperCase()));
    }
    return t;
  }

  // -------------------------------------------------------------- daftar
  function row(p) {
    var r = el('div', 'plist-item' + (p.is_active ? '' : ' inactive'));

    var info = el('div', 'pinfo');
    info.append(el('h3', '', p.name));
    var meta = el('div', 'pmeta');
    meta.append(el('strong', '', S.rupiah(p.price)), el('span', 'tag', p.category), el('span', '', 'Terjual ' + p.sold_count.toLocaleString('id-ID')));
    if (!p.is_active) meta.append(A.pill('Nonaktif', 'muted'));
    info.append(meta);

    var actions = el('div', 'pactions');
    var sw = el('label', 'switch-ui');
    sw.title = p.is_active ? 'Aktif (tampil di toko)' : 'Nonaktif (disembunyikan)';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = p.is_active;
    cb.setAttribute('aria-label', 'Produk aktif: ' + p.name);
    sw.append(cb, el('span'));
    cb.addEventListener('change', async function () {
      var want = cb.checked;
      cb.disabled = true;
      try {
        await api('/admin/products/' + p.id, { method: 'PATCH', body: { is_active: want } });
        S.toast(want ? 'Produk diaktifkan' : 'Produk dinonaktifkan', 'success');
        load();
      } catch (e) {
        cb.checked = !want;
        cb.disabled = false;
        S.toast(e.message, 'error');
      }
    });

    var edit = el('button', 'icon-btn');
    edit.type = 'button';
    edit.setAttribute('aria-label', 'Edit ' + p.name);
    edit.innerHTML = S.icon('edit', 18);
    edit.addEventListener('click', function () { openForm(p); });

    var del = el('button', 'icon-btn');
    del.type = 'button';
    del.setAttribute('aria-label', 'Hapus ' + p.name);
    del.innerHTML = S.icon('trash', 18);
    del.style.color = 'var(--danger)';
    del.addEventListener('click', function () { removeProduct(p); });

    actions.append(sw, edit, del);
    r.append(thumb(p), info, actions);
    return r;
  }

  function skeletonRows() {
    listBox.replaceChildren();
    for (var i = 0; i < 4; i++) {
      var r = el('div', 'plist-item');
      r.innerHTML = '<div class="sk thumb"></div><div class="pinfo"><div class="sk sk-line w70"></div><div class="sk sk-line w40" style="margin-top:8px"></div></div><div></div>';
      listBox.append(r);
    }
    pagerBox.replaceChildren();
  }

  async function load() {
    var myReq = ++state.reqId;
    skeletonRows();
    try {
      var qs = new URLSearchParams({ page: String(state.page), limit: String(state.limit), status: state.status });
      if (state.q) qs.set('q', state.q);
      var data = await api('/admin/products?' + qs.toString());
      if (myReq !== state.reqId) return;

      // halaman terakhir kosong setelah hapus -> mundur satu halaman
      if (data.items.length === 0 && data.total > 0 && state.page > 1) {
        state.page = data.pages;
        return load();
      }

      listBox.replaceChildren();
      if (data.total === 0) {
        var filtered = state.q || state.status !== 'all';
        A.showState(listBox, filtered
          ? { icon: 'searchX', title: 'Produk tidak ditemukan', text: 'Coba kata kunci atau filter lain.' }
          : { icon: 'box', title: 'Belum ada produk', text: 'Tambahkan produk pertama Anda.', label: 'Tambah produk', onClick: function () { openForm(null); } });
        pagerBox.replaceChildren();
        return;
      }
      data.items.forEach(function (p) { listBox.append(row(p)); });
      A.renderPager(pagerBox, data, function (pg) { state.page = pg; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    } catch (e) {
      if (myReq !== state.reqId) return;
      pagerBox.replaceChildren();
      A.showState(listBox, { error: true, icon: 'alert', title: 'Gagal memuat produk', text: e.message, label: 'Coba lagi', onClick: load });
    }
  }

  async function loadCategories() {
    try { state.categories = (await api('/admin/products/categories')).categories; } catch (e) { /* datalist kosong saja */ }
  }

  async function removeProduct(p) {
    var ok = await S.confirmDialog({
      title: 'Hapus produk?',
      message: '"' + p.name + '" akan dihapus permanen beserta gambarnya. Tindakan ini tidak bisa dibatalkan.',
      confirmText: 'Hapus', danger: true
    });
    if (!ok) return;
    try {
      await api('/admin/products/' + p.id, { method: 'DELETE' });
      S.toast('Produk dihapus', 'success');
      load();
      loadCategories();
    } catch (e) {
      S.toast(e.message, 'error');
    }
  }

  // ---------------------------------------------------------------- form
  function openForm(product) {
    var isEdit = !!product;
    var imagePath = isEdit ? product.image_path : null; // path yang tersimpan
    var previewUrl = isEdit ? product.image_url : null;
    var pendingBlob = null; // gambar baru, diunggah saat tombol Simpan ditekan
    var busy = false;
    var objectUrl = null;

    var form = el('form');
    form.noValidate = true;
    form.innerHTML =
      '<div class="form-error" data-err role="alert" hidden></div>' +
      '<div class="img-picker">' +
        '<div class="img-prev" data-prev></div>' +
        '<div class="img-actions">' +
          '<label class="btn btn-ghost btn-sm" style="cursor:pointer;position:relative">' + S.icon('upload', 16) + '<span>Pilih gambar</span>' +
            '<input type="file" data-file accept="image/jpeg,image/png,image/webp"></label>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-rmimg hidden>Hapus gambar</button>' +
          '<span class="hint">JPG/PNG/WEBP. Otomatis dikecilkan.</span>' +
        '</div>' +
      '</div>' +
      '<div class="field"><label for="pf-name">Nama produk</label><input class="input" id="pf-name" maxlength="150" autocomplete="off"></div>' +
      '<div class="field"><label for="pf-price">Harga</label><div class="input-wrap"><span class="prefix">Rp</span>' +
        '<input class="input has-prefix" id="pf-price" inputmode="numeric" autocomplete="off" style="padding-left:42px"></div></div>' +
      '<div class="field"><label for="pf-cat">Kategori</label><input class="input" id="pf-cat" list="pf-catlist" maxlength="50" autocomplete="off"><datalist id="pf-catlist"></datalist></div>' +
      '<div class="field"><label for="pf-desc">Deskripsi</label><textarea class="input" id="pf-desc" maxlength="2000"></textarea></div>' +
      '<div class="check-row"><div><b>Tampil di toko</b><small>Nonaktifkan untuk menyembunyikan produk.</small></div>' +
        '<label class="switch-ui"><input type="checkbox" id="pf-active" aria-label="Produk aktif"><span></span></label></div>';

    var q = function (s) { return form.querySelector(s); };
    var errBox = q('[data-err]'), prev = q('[data-prev]'), fileInput = q('[data-file]'), rmImg = q('[data-rmimg]');
    var fName = q('#pf-name'), fPrice = q('#pf-price'), fCat = q('#pf-cat'), fDesc = q('#pf-desc'), fActive = q('#pf-active');

    // nilai awal diisi lewat properti .value (bukan innerHTML) -> aman dari XSS
    fName.value = isEdit ? product.name : '';
    fPrice.value = isEdit ? product.price.toLocaleString('id-ID') : '';
    fCat.value = isEdit ? product.category : '';
    fDesc.value = isEdit ? product.description : '';
    fActive.checked = isEdit ? product.is_active : true;
    state.categories.forEach(function (c) { var o = document.createElement('option'); o.value = c; q('#pf-catlist').append(o); });

    fPrice.addEventListener('input', function () {
      var digits = fPrice.value.replace(/\D/g, '').slice(0, 13);
      fPrice.value = digits ? Number(digits).toLocaleString('id-ID') : '';
    });

    function paintPreview() {
      prev.replaceChildren();
      if (previewUrl) {
        var img = new Image();
        img.alt = 'Pratinjau gambar';
        img.src = previewUrl;
        prev.append(img);
      } else {
        prev.innerHTML = S.icon('image', 30);
      }
      rmImg.hidden = !previewUrl;
    }
    paintPreview();

    fileInput.addEventListener('change', async function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      errBox.hidden = true;
      try {
        pendingBlob = await processImage(f);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(pendingBlob);
        previewUrl = objectUrl;
        paintPreview();
      } catch (e) {
        showErr(e.message);
      }
    });
    rmImg.addEventListener('click', function () {
      pendingBlob = null;
      imagePath = null;
      previewUrl = null;
      paintPreview();
    });

    function showErr(msg) { errBox.textContent = msg; errBox.hidden = false; errBox.scrollIntoView({ block: 'nearest' }); }

    var handle;
    function saveBtn() { return handle.el.querySelector('.modal-foot .btn-primary'); }
    function setBusy(on) {
      busy = on;
      var b = saveBtn();
      b.disabled = on;
      b.classList.toggle('loading', on);
    }

    async function save() {
      if (busy) return;
      errBox.hidden = true;

      var name = fName.value.trim().replace(/\s+/g, ' ');
      var priceDigits = fPrice.value.replace(/\D/g, '');
      var category = fCat.value.trim().replace(/\s+/g, ' ');
      if (name.length < 2 || name.length > 150) return showErr('Nama produk 2-150 karakter.');
      if (!priceDigits || Number(priceDigits) <= 0) return showErr('Harga harus lebih dari 0.');
      if (!category) category = 'Umum';
      if (category.length > 50) return showErr('Kategori maksimal 50 karakter.');

      setBusy(true);
      try {
        var path = imagePath;
        if (pendingBlob) {
          var up = await api('/admin/uploads/product-image', { method: 'POST', raw: pendingBlob, contentType: pendingBlob.type });
          path = up.image_path;
        }
        var body = {
          name: name, price: Number(priceDigits), category: category,
          description: fDesc.value.trim(), is_active: fActive.checked, image_path: path
        };
        if (isEdit) await api('/admin/products/' + product.id, { method: 'PATCH', body: body });
        else await api('/admin/products', { method: 'POST', body: body });

        S.toast(isEdit ? 'Produk diperbarui' : 'Produk ditambahkan', 'success');
        handle.close();
        if (!isEdit) { state.page = 1; }
        load();
        loadCategories();
      } catch (e) {
        showErr(e.message);
        setBusy(false);
      }
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });

    handle = S.openModal({
      title: isEdit ? 'Edit produk' : 'Tambah produk',
      body: form,
      onClose: function () { if (objectUrl) URL.revokeObjectURL(objectUrl); },
      actions: [
        { label: 'Batal', className: 'btn-ghost' },
        { label: 'Simpan', className: 'btn-primary', onClick: save }
      ]
    });
    setTimeout(function () { fName.focus(); }, 60);
  }

  // ----------------------------------------------------------- kontrol
  var timer;
  searchInput.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var v = searchInput.value.trim();
      if (v === state.q) return;
      state.q = v;
      state.page = 1;
      load();
    }, 350);
  });
  statusGroup.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-status]');
    if (!b || b.getAttribute('data-status') === state.status) return;
    state.status = b.getAttribute('data-status');
    state.page = 1;
    statusGroup.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    load();
  });
  addBtn.addEventListener('click', function () { openForm(null); });

  (async function start() {
    var admin = await A.initShell('products');
    if (!admin) return;
    loadCategories();
    load();
  })();
})();
