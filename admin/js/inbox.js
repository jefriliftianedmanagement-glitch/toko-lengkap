/* inbox.js - PART 5: inbox admin, approve dan reject top-up */
(function () {
  'use strict';
  var S = window.Shop, A = window.Admin, el = S.el;
  var list = document.getElementById('inboxList');
  var pager = document.getElementById('pager');
  var summary = document.getElementById('inboxSummary');
  var search = document.getElementById('q');
  var statusGroup = document.getElementById('statusGroup');
  var refreshBtn = document.getElementById('refreshBtn');
  var state = { page: 1, status: 'PENDING', q: '', loading: false, timer: null };

  function fmtDate(value) { return A.fmtDate(value); }

  function renderPager(data) {
    pager.replaceChildren();
    if (!data.total) return;
    var label = el('span', '', 'Halaman ' + data.page + ' dari ' + data.pages + ' • ' + data.total.toLocaleString('id-ID') + ' permintaan');
    var btns = el('div', 'pager-btns');
    var prev = el('button', 'btn btn-ghost btn-sm', 'Sebelumnya');
    var next = el('button', 'btn btn-ghost btn-sm', 'Berikutnya');
    prev.type = next.type = 'button';
    prev.disabled = data.page <= 1;
    next.disabled = data.page >= data.pages;
    prev.addEventListener('click', function () { load(data.page - 1); });
    next.addEventListener('click', function () { load(data.page + 1); });
    btns.append(prev, next);
    pager.append(label, btns);
  }

  function render(items, data) {
    list.replaceChildren();
    summary.textContent = data.total.toLocaleString('id-ID') + ' permintaan' + (state.status === 'PENDING' ? ' menunggu pemeriksaan' : ' ditemukan');
    if (!items.length) {
      A.showState(list, {
        icon: state.status === 'PENDING' ? 'check' : 'mail',
        title: state.q ? 'Tidak ada hasil' : state.status === 'PENDING' ? 'Antrean sudah bersih' : 'Belum ada permintaan',
        text: state.q ? 'Coba username atau ID akun yang berbeda.' : state.status === 'PENDING' ? 'Semua permintaan top-up sudah ditinjau.' : 'Permintaan pengguna akan muncul di sini.'
      });
      pager.replaceChildren();
      return;
    }

    var wrap = el('div', 'table-wrap');
    var table = el('table', 'data inbox-table');
    var thead = el('thead');
    var hr = el('tr');
    ['Diajukan', 'Pengguna', 'Nominal', 'Status', 'Tindakan'].forEach(function (heading, index) {
      hr.append(el('th', index === 2 ? 'num' : '', heading));
    });
    thead.append(hr);
    var tbody = el('tbody');

    items.forEach(function (item) {
      var tr = el('tr');
      var time = el('td', 'inbox-time', fmtDate(item.created_at));
      var user = el('td', 'cell-user');
      var username = item.user && item.user.username ? '@' + item.user.username : 'Pengguna tidak tersedia';
      var accountId = item.user && item.user.account_id ? 'ID ' + item.user.account_id : '';
      user.append(el('b', '', username), el('small', '', accountId));
      var amount = el('td', 'num inbox-amount', S.rupiah(item.amount));
      var status = el('td');
      status.append(A.statusPill(item.status));
      var actions = el('td', 'inbox-actions');

      if (item.status === 'PENDING') {
        var approve = el('button', 'btn btn-primary btn-sm', 'Setujui');
        var reject = el('button', 'btn btn-danger btn-sm', 'Tolak');
        approve.type = reject.type = 'button';
        approve.addEventListener('click', function () { resolveRequest(item, 'approve', approve); });
        reject.addEventListener('click', function () { openReject(item, reject); });
        actions.append(approve, reject);
      } else {
        actions.append(el('span', 'inbox-processed', item.processed_at ? 'Diproses ' + fmtDate(item.processed_at) : '—'));
      }

      tr.append(time, user, amount, status, actions);
      tbody.append(tr);
    });

    table.append(thead, tbody);
    wrap.append(table);
    list.append(wrap);
    renderPager(data);
  }

  async function load(page) {
    if (state.loading) return;
    state.loading = true;
    state.page = page || 1;
    summary.textContent = 'Memuat permintaan…';
    list.replaceChildren();
    var loading = el('div', 'inbox-loading');
    loading.append(el('span', 'spinner'), el('span', '', 'Mengambil data dari server…'));
    list.append(loading);
    var query = new URLSearchParams({ status: state.status, page: String(state.page), limit: '20' });
    if (state.q) query.set('q', state.q);
    try {
      var data = await S.api('/admin/topups?' + query.toString());
      render(data.items || [], data);
    } catch (err) {
      summary.textContent = 'Tidak dapat memuat permintaan';
      A.showState(list, { error: true, icon: 'alert', title: 'Gagal memuat inbox', text: err.message, label: 'Coba lagi', onClick: function () { load(state.page); } });
      pager.replaceChildren();
    } finally {
      state.loading = false;
    }
  }

  async function resolveRequest(item, action, button, reason) {
    if (button) button.disabled = true;
    if (action === 'approve') {
      var ok = await S.confirmDialog({
        title: 'Setujui permintaan top-up?',
        message: 'Setujui ' + S.rupiah(item.amount) + ' untuk @' + (item.user && item.user.username ? item.user.username : 'pengguna') + '? Saldo belum bertambah sampai pengguna melakukan klaim.',
        confirmText: 'Ya, setujui'
      });
      if (!ok) { if (button) button.disabled = false; return; }
    }
    try {
      await S.api('/admin/topups/' + encodeURIComponent(item.id) + '/' + action, {
        method: 'POST',
        body: action === 'reject' ? { reason: reason || '' } : {}
      });
      S.toast(action === 'approve' ? 'Permintaan berhasil disetujui.' : 'Permintaan berhasil ditolak.', 'success');
      load(state.page);
    } catch (err) {
      S.toast(err.message, 'error');
      if (button) button.disabled = false;
    }
  }

  function openReject(item, button) {
    var body = el('div', 'reject-form');
    var desc = el('p', 'reject-description', 'Permintaan sebesar ' + S.rupiah(item.amount) + ' dari @' + (item.user && item.user.username ? item.user.username : 'pengguna') + ' akan ditolak.');
    var field = el('div', 'field');
    var label = el('label', '', 'Alasan penolakan (opsional)');
    var reason = el('textarea', 'input reject-reason');
    reason.rows = 3;
    reason.maxLength = 250;
    reason.placeholder = 'Contoh: nominal permintaan perlu diperbaiki…';
    var hint = el('span', 'hint', 'Maksimal 250 karakter. Alasan akan dikirim sebagai pesan ke pengguna.');
    field.append(label, reason, hint);
    body.append(desc, field);
    S.openModal({
      title: 'Tolak permintaan top-up',
      body: body,
      actions: [
        { label: 'Batal', className: 'btn-ghost' },
        {
          label: 'Tolak permintaan', className: 'btn-danger',
          onClick: function (modal) {
            var value = reason.value.trim();
            if (value.length > 250) {
              S.toast('Alasan maksimal 250 karakter.', 'error');
              return;
            }
            modal.close();
            resolveRequest(item, 'reject', button, value);
          }
        }
      ]
    });
    reason.focus();
  }

  statusGroup.addEventListener('click', function (event) {
    var button = event.target.closest('[data-status]');
    if (!button) return;
    state.status = button.getAttribute('data-status');
    state.page = 1;
    statusGroup.querySelectorAll('[data-status]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b === button));
    });
    load(1);
  });

  search.addEventListener('input', function () {
    clearTimeout(state.timer);
    state.timer = setTimeout(function () {
      state.q = search.value.trim().slice(0, 50);
      load(1);
    }, 300);
  });
  refreshBtn.addEventListener('click', function () { load(state.page); });

  (async function start() {
    var admin = await A.initShell('inbox');
    if (!admin) return;
    load(1);
  })();
})();
