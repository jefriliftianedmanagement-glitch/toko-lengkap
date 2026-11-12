/* users.js - PART 11: kelola status akun dan hapus identitas secara permanen. */
(function () {
  'use strict';
  var S = window.Shop, A = window.Admin, el = S.el;
  var box = document.getElementById('ulist');
  var pagerBox = document.getElementById('pager');
  var searchInput = document.getElementById('q');
  var state = { q: '', page: 1, limit: 15, reqId: 0 };

  function actionButton(label, className, handler) {
    var button = el('button', 'btn ' + className + ' btn-sm', label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function render(items) {
    box.replaceChildren();
    var wrap = el('div', 'table-wrap');
    var table = el('table', 'data');
    var thead = el('thead');
    var hr = el('tr');
    ['Pengguna', 'ID Akun', 'Saldo', 'Status', 'Terdaftar', 'Tindakan'].forEach(function (h, i) {
      var th = el('th', i === 2 ? 'num' : '', h);
      if (i === 4) th.className = 'hide-sm';
      hr.append(th);
    });
    thead.append(hr);
    var tbody = el('tbody');
    items.forEach(function (u) {
      var tr = el('tr');
      var tdU = el('td', 'cell-user');
      tdU.append(el('b', '', '@' + u.username));
      var tdI = el('td', 'mono', String(u.account_id));
      var tdB = el('td', 'num', S.rupiah(u.balance));
      var tdS = el('td');
      tdS.append(A.pill(u.is_active ? 'Aktif' : 'Diblokir', u.is_active ? 'success' : 'danger'));
      var tdD = el('td', 'hide-sm', A.fmtDate(u.created_at));
      tdD.style.whiteSpace = 'nowrap';
      var tdA = el('td', 'user-actions');
      if (u.is_active) {
        tdA.append(actionButton('Block', 'btn-ghost', function () { setBlocked(u, true); }));
      } else {
        tdA.append(actionButton('Unblock', 'btn-primary', function () { setBlocked(u, false); }));
      }
      tdA.append(actionButton('Hapus akun', 'btn-danger', function () { deleteUser(u); }));
      tr.append(tdU, tdI, tdB, tdS, tdD, tdA);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    box.append(wrap);
  }

  async function setBlocked(user, blocked) {
    var ok = await S.confirmDialog({
      title: blocked ? 'Block akun ini?' : 'Unblock akun ini?',
      message: blocked
        ? 'Pengguna tidak dapat login atau memakai layanan selama diblokir. Data akun, saldo, transaksi, dan inbox tetap tersimpan. Anda dapat melakukan unblock kapan saja.'
        : 'Akun akan diaktifkan kembali dan pengguna dapat login seperti biasa.',
      confirmText: blocked ? 'Block akun' : 'Unblock',
      danger: blocked
    });
    if (!ok) return;
    try {
      await S.api('/admin/users/' + encodeURIComponent(user.id) + '/status', {
        method: 'PATCH', body: { blocked: blocked }
      });
      S.toast(blocked ? 'Akun berhasil diblokir.' : 'Akun berhasil diaktifkan kembali.', 'success');
      load();
    } catch (err) { S.toast(err.message, 'error'); }
  }

  async function deleteUser(user) {
    var ok = await S.confirmDialog({
      title: 'Hapus akun secara permanen?',
      message: 'Identitas dan akses akun @' + user.username + ' akan dihapus permanen. Wallet (termasuk saldo yang tersisa) dan inbox akan ikut dihapus. Catatan transaksi dan ledger saldo tetap disimpan tanpa profil pengguna untuk menjaga integritas keuangan. Tindakan ini tidak dapat dibatalkan.',
      confirmText: 'Hapus permanen',
      danger: true
    });
    if (!ok) return;
    try {
      await S.api('/admin/users/' + encodeURIComponent(user.id), { method: 'DELETE' });
      S.toast('Akun berhasil dihapus. Catatan keuangan tetap dipertahankan.', 'success', 5000);
      load();
    } catch (err) { S.toast(err.message, 'error'); }
  }

  async function load() {
    var myReq = ++state.reqId;
    box.replaceChildren();
    for (var i = 0; i < 5; i++) {
      var sk = el('div', 'sk');
      sk.style.cssText = 'height:44px;margin:12px 16px';
      box.append(sk);
    }
    pagerBox.replaceChildren();
    try {
      var qs = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
      if (state.q) qs.set('q', state.q);
      var data = await S.api('/admin/users?' + qs.toString());
      if (myReq !== state.reqId) return;
      if (data.total === 0) {
        A.showState(box, { icon: 'users', title: state.q ? 'Pengguna tidak ditemukan' : 'Belum ada pengguna', text: state.q ? 'Coba username atau ID akun lain.' : 'Pengguna akan muncul setelah mendaftar.' });
        return;
      }
      render(data.items);
      A.renderPager(pagerBox, data, function (pg) { state.page = pg; load(); });
    } catch (e) {
      if (myReq !== state.reqId) return;
      A.showState(box, { error: true, icon: 'alert', title: 'Gagal memuat pengguna', text: e.message, label: 'Coba lagi', onClick: load });
    }
  }

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

  (async function start() {
    var admin = await A.initShell('users');
    if (!admin) return;
    load();
  })();
})();
