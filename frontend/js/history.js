/* history.js - PART 8: riwayat transaksi milik pengguna yang sedang login. */
(function () {
  'use strict';
  var S = window.Shop, el = S.el;
  var listBox = document.getElementById('historyList');
  var pagerBox = document.getElementById('historyPager');
  var filterBox = document.getElementById('historyFilters');
  var fromInput = document.getElementById('historyFrom');
  var toInput = document.getElementById('historyTo');
  var state = { type: 'all', from: '', to: '', page: 1, limit: 15, reqId: 0 };

  var TYPES = {
    TOPUP_CLAIM: { label: 'Klaim top-up', icon: 'wallet', direction: 'credit' },
    ADMIN_SEND_BALANCE: { label: 'Saldo dari admin', icon: 'send', direction: 'credit' },
    PURCHASE: { label: 'Pembelian produk', icon: 'bag', direction: 'debit' }
  };

  function fmtDate(iso) {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function statusPill(status) {
    var ok = status === 'SUCCESS';
    return el('span', 'history-status ' + (ok ? 'is-success' : 'is-danger'), ok ? 'Berhasil' : 'Gagal');
  }

  function copyCode(code, button) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      S.toast('Browser tidak mendukung salin otomatis.', 'error');
      return;
    }
    button.disabled = true;
    navigator.clipboard.writeText(code).then(function () {
      S.toast('Kode transaksi disalin.', 'success');
    }).catch(function () {
      S.toast('Gagal menyalin kode transaksi.', 'error');
    }).finally(function () { button.disabled = false; });
  }

  function renderItem(item) {
    var meta = TYPES[item.type] || { label: item.type || 'Transaksi', icon: 'receipt', direction: 'credit' };
    var card = el('article', 'history-item');
    var icon = el('div', 'history-item-icon ' + (meta.direction === 'debit' ? 'is-debit' : 'is-credit'));
    icon.innerHTML = S.icon(meta.icon, 21);

    var content = el('div', 'history-item-content');
    var top = el('div', 'history-item-top');
    top.append(el('strong', 'history-item-title', meta.label), statusPill(item.status));
    var desc = el('p', 'history-item-description', item.description || meta.label);
    var details = el('div', 'history-item-meta');
    details.append(el('span', '', fmtDate(item.created_at)));
    var codeBtn = el('button', 'history-code', item.transaction_code || 'Kode tidak tersedia');
    codeBtn.type = 'button';
    codeBtn.title = 'Salin kode transaksi';
    codeBtn.addEventListener('click', function () { copyCode(item.transaction_code, codeBtn); });
    details.append(codeBtn);
    content.append(top, desc, details);

    var amount = el('div', 'history-item-amount ' + (meta.direction === 'debit' ? 'is-debit' : 'is-credit'));
    var prefix = meta.direction === 'debit' ? '−' : '+';
    amount.append(el('strong', '', prefix + S.rupiah(item.amount)), el('small', '', meta.direction === 'debit' ? 'Saldo keluar' : 'Saldo masuk'));
    var actions = el('div', 'history-item-actions');
    var removeBtn = el('button', 'btn btn-ghost btn-sm', 'Hapus dari riwayat');
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', function () { removeTransaction(item, removeBtn); });
    actions.append(removeBtn);
    card.append(icon, content, amount, actions);
    return card;
  }


  async function removeTransaction(item, button) {
    var ok = await S.confirmDialog({
      title: 'Hapus dari riwayat Anda?',
      message: 'Transaksi ini hanya akan disembunyikan dari riwayat akun Anda. Admin masih dapat melihat catatan transaksi, dan catatan saldo permanen tidak dihapus.',
      confirmText: 'Hapus dari riwayat',
      danger: true
    });
    if (!ok) return;
    button.disabled = true;
    try {
      await S.api('/transactions/' + encodeURIComponent(item.id), { method: 'DELETE' });
      S.toast('Transaksi dihapus dari riwayat akun Anda.', 'success');
      state.page = 1;
      load();
    } catch (err) {
      S.toast(err.message, 'error');
      button.disabled = false;
    }
  }

  function showEmpty() {
    listBox.replaceChildren();
    var box = el('div', 'history-empty');
    var ic = el('div', 'history-empty-icon');
    ic.innerHTML = S.icon('receipt', 28);
    var hasFilter = state.type !== 'all' || state.from || state.to;
    box.append(ic,
      el('h2', '', hasFilter ? 'Transaksi tidak ditemukan' : 'Belum ada transaksi'),
      el('p', '', hasFilter ? 'Coba ubah filter jenis atau rentang tanggal.' : 'Transaksi yang berhasil diproses akan muncul di sini.')
    );
    if (!hasFilter) {
      var link = el('a', 'btn btn-primary', 'Jelajahi toko');
      link.href = 'dashboard.html';
      box.append(link);
    }
    listBox.append(box);
  }

  function renderPager(data) {
    pagerBox.replaceChildren();
    if (!data.total) return;
    var info = el('span', '', 'Halaman ' + data.page + ' dari ' + data.pages + ' · ' + data.total.toLocaleString('id-ID') + ' transaksi');
    var controls = el('div', 'history-pager-controls');
    var prev = el('button', 'btn btn-ghost btn-sm', 'Sebelumnya');
    var next = el('button', 'btn btn-ghost btn-sm', 'Berikutnya');
    prev.type = next.type = 'button';
    prev.disabled = data.page <= 1;
    next.disabled = data.page >= data.pages;
    prev.addEventListener('click', function () { state.page = Math.max(1, data.page - 1); load(); });
    next.addEventListener('click', function () { state.page = Math.min(data.pages, data.page + 1); load(); });
    controls.append(prev, next);
    pagerBox.append(info, controls);
  }

  async function load() {
    var reqId = ++state.reqId;
    listBox.setAttribute('aria-busy', 'true');
    listBox.replaceChildren();
    var loading = el('div', 'history-loading');
    loading.append(el('span', 'spinner'), el('span', '', 'Memuat riwayat transaksi…'));
    listBox.append(loading);
    pagerBox.replaceChildren();

    try {
      var qs = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
      if (state.type !== 'all') qs.set('type', state.type);
      if (state.from) qs.set('from', state.from);
      if (state.to) qs.set('to', state.to);
      var data = await S.api('/transactions?' + qs.toString());
      if (reqId !== state.reqId) return;
      listBox.replaceChildren();
      if (!data.items.length) showEmpty();
      else {
        var stack = el('div', 'history-items');
        data.items.forEach(function (item) { stack.append(renderItem(item)); });
        listBox.append(stack);
      }
      renderPager(data);
    } catch (err) {
      if (reqId !== state.reqId) return;
      listBox.replaceChildren();
      var box = el('div', 'history-empty history-error');
      var ic = el('div', 'history-empty-icon');
      ic.innerHTML = S.icon('alert', 28);
      var retry = el('button', 'btn btn-primary', 'Coba lagi');
      retry.type = 'button';
      retry.addEventListener('click', load);
      box.append(ic, el('h2', '', 'Riwayat gagal dimuat'), el('p', '', err.message), retry);
      listBox.append(box);
    } finally {
      if (reqId === state.reqId) listBox.setAttribute('aria-busy', 'false');
    }
  }

  filterBox.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-type]');
    if (!button) return;
    state.type = button.getAttribute('data-type');
    state.page = 1;
    filterBox.querySelectorAll('button[data-type]').forEach(function (node) {
      var active = node === button;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    load();
  });

  function applyDates() {
    var from = fromInput.value;
    var to = toInput.value;
    if (from && to && from > to) {
      S.toast('Tanggal mulai tidak boleh melewati tanggal akhir.', 'error');
      return;
    }
    state.from = from;
    state.to = to;
    state.page = 1;
    load();
  }
  fromInput.addEventListener('change', applyDates);
  toInput.addEventListener('change', applyDates);
  document.getElementById('clearHistoryDates').addEventListener('click', function () {
    fromInput.value = '';
    toInput.value = '';
    state.from = '';
    state.to = '';
    state.page = 1;
    load();
  });
  document.getElementById('refreshHistory').addEventListener('click', load);

  (async function start() {
    var user = await S.initShell('history');
    if (!user) return;
    S.fillIcons(document.querySelector('.history-page'));
    load();
  })();
})();
