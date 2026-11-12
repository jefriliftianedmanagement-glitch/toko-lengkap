/* transactions.js (admin) - riwayat seluruh transaksi; hanya dibuka lewat sesi admin. */
(function () {
  'use strict';
  var S = window.Shop, A = window.Admin, el = S.el;
  var listBox = document.getElementById('txList');
  var pagerBox = document.getElementById('txPager');
  var summary = document.getElementById('txSummary');
  var searchInput = document.getElementById('txSearch');
  var typeGroup = document.getElementById('txTypeFilters');
  var statusGroup = document.getElementById('txStatusFilters');
  var fromInput = document.getElementById('txFrom');
  var toInput = document.getElementById('txTo');
  var state = { q: '', type: 'all', status: 'all', from: '', to: '', page: 1, limit: 20, reqId: 0 };

  function render(items) {
    listBox.replaceChildren();
    var wrap = el('div', 'table-wrap');
    var table = el('table', 'data tx-table');
    var thead = el('thead');
    var hr = el('tr');
    ['Waktu', 'Pengguna', 'Jenis / Keterangan', 'Nominal', 'Status', 'Kode Transaksi', 'Tindakan'].forEach(function (label, i) {
      var th = el('th', i === 3 ? 'num' : '', label);
      if (i === 0 || i === 5) th.classList.add('hide-sm');
      hr.append(th);
    });
    thead.append(hr);
    var tbody = el('tbody');
    items.forEach(function (t) {
      var tr = el('tr');
      var time = el('td', 'hide-sm tx-time', A.fmtDate(t.created_at));
      var user = el('td', 'cell-user');
      user.append(el('b', '', t.username ? '@' + t.username : 'Pengguna tidak tersedia'));
      user.append(el('small', '', t.account_id ? 'ID ' + t.account_id : 'ID —'));

      var detail = el('td', 'tx-description');
      detail.append(el('strong', '', A.typeLabel(t.type)));
      detail.append(el('small', '', t.description || '—'));
      var amount = el('td', 'num tx-amount', S.rupiah(t.amount));
      var status = el('td');
      status.append(A.statusPill(t.status));
      var code = el('td', 'mono hide-sm', t.transaction_code || '—');
      var actions = el('td', 'tx-admin-actions');
      var remove = el('button', 'btn btn-danger btn-sm', 'Hapus');
      remove.type = 'button';
      remove.addEventListener('click', function () { removeTransaction(t, remove); });
      actions.append(remove);
      if (t.user_hidden_at) actions.append(el('small', 'tx-hidden-note', 'Disembunyikan user'));
      tr.append(time, user, detail, amount, status, code, actions);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    listBox.append(wrap);
  }


  async function removeTransaction(item, button) {
    var ok = await S.confirmDialog({
      title: 'Hapus transaksi dari seluruh riwayat?',
      message: 'Transaksi ' + (item.transaction_code || '') + ' akan disembunyikan dari halaman admin dan riwayat pengguna. Catatan ledger dan perubahan saldo tidak dihapus atau dibalik. Tindakan ini tidak dapat dibatalkan dari halaman ini.',
      confirmText: 'Hapus transaksi',
      danger: true
    });
    if (!ok) return;
    button.disabled = true;
    try {
      await S.api('/admin/transactions/' + encodeURIComponent(item.id), { method: 'DELETE' });
      S.toast('Transaksi disembunyikan dari seluruh riwayat. Ledger tetap tersimpan.', 'success', 5000);
      state.page = 1;
      load();
    } catch (err) {
      S.toast(err.message, 'error');
      button.disabled = false;
    }
  }

  function queryString() {
    var qs = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
    if (state.q) qs.set('q', state.q);
    if (state.type !== 'all') qs.set('type', state.type);
    if (state.status !== 'all') qs.set('status', state.status);
    if (state.from) qs.set('from', state.from);
    if (state.to) qs.set('to', state.to);
    return qs.toString();
  }

  async function load() {
    var reqId = ++state.reqId;
    listBox.setAttribute('aria-busy', 'true');
    listBox.replaceChildren();
    var loading = el('div', 'tx-loading');
    loading.append(el('span', 'spinner'), el('span', '', 'Memuat transaksi…'));
    listBox.append(loading);
    summary.textContent = 'Memuat transaksi…';
    pagerBox.replaceChildren();

    try {
      var data = await S.api('/admin/transactions?' + queryString());
      if (reqId !== state.reqId) return;
      summary.textContent = data.total.toLocaleString('id-ID') + ' transaksi ditemukan';
      if (!data.items.length) {
        A.showState(listBox, {
          icon: 'receipt',
          title: state.q || state.type !== 'all' || state.status !== 'all' || state.from || state.to ? 'Transaksi tidak ditemukan' : 'Belum ada transaksi',
          text: 'Coba ubah kata kunci atau filter pencarian.'
        });
      } else render(data.items);
      A.renderPager(pagerBox, data, function (page) { state.page = page; load(); });
    } catch (err) {
      if (reqId !== state.reqId) return;
      summary.textContent = 'Riwayat transaksi tidak tersedia';
      A.showState(listBox, { error: true, icon: 'alert', title: 'Gagal memuat transaksi', text: err.message, label: 'Coba lagi', onClick: load });
    } finally {
      if (reqId === state.reqId) listBox.setAttribute('aria-busy', 'false');
    }
  }

  var timer;
  searchInput.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var q = searchInput.value.trim();
      if (q === state.q) return;
      state.q = q;
      state.page = 1;
      load();
    }, 350);
  });

  function bindSegment(group, key, attr) {
    group.addEventListener('click', function (event) {
      var button = event.target.closest('button[' + attr + ']');
      if (!button) return;
      state[key] = button.getAttribute(attr);
      state.page = 1;
      group.querySelectorAll('button[' + attr + ']').forEach(function (node) {
        var active = node === button;
        node.setAttribute('aria-pressed', String(active));
      });
      load();
    });
  }
  bindSegment(typeGroup, 'type', 'data-type');
  bindSegment(statusGroup, 'status', 'data-status');

  function applyDates() {
    var from = fromInput.value;
    var to = toInput.value;
    if (from && to && from > to) {
      S.toast('Tanggal awal tidak boleh melewati tanggal akhir.', 'error');
      return;
    }
    state.from = from;
    state.to = to;
    state.page = 1;
    load();
  }
  fromInput.addEventListener('change', applyDates);
  toInput.addEventListener('change', applyDates);
  document.getElementById('clearTxDates').addEventListener('click', function () {
    fromInput.value = '';
    toInput.value = '';
    state.from = '';
    state.to = '';
    state.page = 1;
    load();
  });
  document.getElementById('refreshTransactions').addEventListener('click', load);

  (async function start() {
    var admin = await A.initShell('transactions');
    if (!admin) return;
    load();
  })();
})();
