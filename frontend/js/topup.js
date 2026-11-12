/* topup.js - PART 5: permintaan top-up user dan status request */
(function () {
  'use strict';
  var S = window.Shop;
  var el = S.el;
  var form = document.getElementById('topupForm');
  var amountInput = document.getElementById('amountInput');
  var amountPreview = document.getElementById('amountPreview');
  var submitBtn = document.getElementById('topupSubmit');
  var feedback = document.getElementById('topupFeedback');
  var list = document.getElementById('topupList');
  var pager = document.getElementById('topupPager');
  var refreshBtn = document.getElementById('refreshTopups');
  var state = { page: 1, pages: 1, loading: false };

  var STATUS = {
    PENDING: ['Menunggu', 'warn'],
    APPROVED: ['Disetujui', 'success'],
    REJECTED: ['Ditolak', 'danger'],
    CLAIMED: ['Sudah diklaim', 'success'],
    CANCELLED: ['Dibatalkan', 'muted']
  };

  function fmtDate(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function statusPill(value) {
    var item = STATUS[value] || [value || 'Tidak diketahui', 'muted'];
    return el('span', 'topup-status topup-status-' + item[1], item[0]);
  }

  function updatePreview() {
    var value = amountInput.value;
    var amount = /^\d+$/.test(value) ? Number(value) : 0;
    amountPreview.textContent = Number.isSafeInteger(amount) && amount > 0 ? S.rupiah(amount) : 'Rp0';
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.classList.toggle('loading', busy);
    submitBtn.textContent = busy ? 'Mengirim permintaan…' : 'Kirim permintaan top-up';
  }

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = 'topup-feedback' + (type ? ' topup-feedback-' + type : '');
    feedback.hidden = !message;
  }

  function renderPager(data) {
    pager.replaceChildren();
    if (!data.total) return;
    state.page = data.page;
    state.pages = data.pages;
    var info = el('span', '', 'Halaman ' + data.page + ' dari ' + data.pages + ' • ' + data.total.toLocaleString('id-ID') + ' permintaan');
    var controls = el('div', 'pager-controls');
    var prev = el('button', 'btn btn-ghost btn-sm', 'Sebelumnya');
    var next = el('button', 'btn btn-ghost btn-sm', 'Berikutnya');
    prev.type = next.type = 'button';
    prev.disabled = data.page <= 1;
    next.disabled = data.page >= data.pages;
    prev.addEventListener('click', function () { load(data.page - 1); });
    next.addEventListener('click', function () { load(data.page + 1); });
    controls.append(prev, next);
    pager.append(info, controls);
  }

  function render(items, data) {
    list.replaceChildren();
    if (!items.length) {
      var empty = el('div', 'topup-empty');
      empty.append(el('span', 'topup-empty-icon', '＋'), el('h3', '', 'Belum ada permintaan'), el('p', '', 'Permintaan top-up yang Anda kirim akan tampil di sini.'));
      list.append(empty);
      pager.replaceChildren();
      return;
    }

    var wrap = el('div', 'topup-request-list');
    items.forEach(function (item) {
      var row = el('article', 'topup-request-item');
      var main = el('div', 'topup-request-main');
      var amount = el('strong', 'topup-request-amount', S.rupiah(item.amount));
      var meta = el('div', 'topup-request-meta');
      meta.append(el('span', '', 'Dibuat ' + fmtDate(item.created_at)));
      if (item.processed_at) meta.append(el('span', '', 'Diproses ' + fmtDate(item.processed_at)));
      main.append(amount, meta);
      var side = el('div', 'topup-request-side');
      side.append(statusPill(item.status));

      if (item.status === 'PENDING') {
        var cancel = el('button', 'btn btn-ghost btn-sm topup-cancel', 'Batalkan');
        cancel.type = 'button';
        cancel.addEventListener('click', function () { cancelRequest(item.id, cancel); });
        side.append(cancel);
      } else if (item.status === 'APPROVED') {
        var inboxLink = el('a', 'topup-status-note', 'Klaim saldo di Inbox →');
        inboxLink.href = 'mailbox.html';
        side.append(inboxLink);
      } else if (item.status === 'REJECTED') {
        side.append(el('small', 'topup-status-note', 'Permintaan tidak menambah saldo.'));
      }
      row.append(main, side);
      wrap.append(row);
    });
    list.append(wrap);
    renderPager(data);
  }

  async function load(page) {
    if (state.loading) return;
    state.loading = true;
    list.replaceChildren();
    var loading = el('div', 'topup-list-loading');
    loading.append(el('span', 'spinner'), el('span', '', 'Memuat permintaan…'));
    list.append(loading);
    try {
      var data = await S.api('/topups?page=' + (page || 1) + '&limit=10');
      render(data.items || [], data);
    } catch (err) {
      S.toast(err.message, 'error');
      var retry = el('button', 'btn btn-ghost', 'Coba lagi');
      retry.type = 'button';
      retry.addEventListener('click', function () { load(page || 1); });
      list.replaceChildren();
      var box = el('div', 'topup-empty');
      box.append(el('h3', '', 'Gagal memuat permintaan'), el('p', '', err.message), retry);
      list.append(box);
    } finally {
      state.loading = false;
    }
  }

  async function cancelRequest(id, button) {
    var ok = await S.confirmDialog({
      title: 'Batalkan permintaan?',
      message: 'Permintaan yang masih menunggu dapat dibatalkan. Tindakan ini tidak dapat diurungkan.',
      confirmText: 'Ya, batalkan',
      danger: true
    });
    if (!ok) return;
    button.disabled = true;
    try {
      await S.api('/topups/' + encodeURIComponent(id), { method: 'DELETE' });
      S.toast('Permintaan top-up dibatalkan.', 'success');
      load(state.page);
    } catch (err) {
      S.toast(err.message, 'error');
      button.disabled = false;
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var raw = amountInput.value.trim();
    if (!/^\d{1,13}$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0 || Number(raw) > 1000000000000) {
      showFeedback('Masukkan nominal bilangan bulat yang valid dan lebih dari Rp0.', 'error');
      amountInput.focus();
      return;
    }

    showFeedback('', '');
    setBusy(true);
    try {
      var result = await S.api('/topups', { method: 'POST', body: { amount: Number(raw) } });
      amountInput.value = '';
      updatePreview();
      showFeedback('Permintaan ' + (result.request && result.request.request_id ? 'berhasil dikirim' : 'berhasil dibuat') + '. Saldo Anda belum berubah dan menunggu pemeriksaan admin.', 'success');
      S.toast('Permintaan top-up berhasil dikirim.', 'success');
      load(1);
    } catch (err) {
      showFeedback(err.message, 'error');
    } finally {
      setBusy(false);
    }
  });

  amountInput.addEventListener('input', updatePreview);
  document.querySelectorAll('[data-amount]').forEach(function (button) {
    button.addEventListener('click', function () {
      amountInput.value = button.getAttribute('data-amount');
      updatePreview();
      amountInput.focus();
      document.querySelectorAll('[data-amount]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
    });
  });
  refreshBtn.addEventListener('click', function () { load(state.page); });

  (async function start() {
    var me = await S.initShell('topup');
    if (!me) return;
    S.fillIcons(document);
    updatePreview();
    load(1);
  })();
})();
