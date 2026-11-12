/* mailbox.js - PART 6: inbox pengguna dan klaim saldo virtual */
(function () {
  'use strict';

  var S = window.Shop;
  var el = S.el;
  var list = document.getElementById('mailboxList');
  var pager = document.getElementById('mailboxPager');
  var unreadLabel = document.getElementById('mailboxUnreadCount');
  var markAllBtn = document.getElementById('markAllRead');
  var refreshBtn = document.getElementById('refreshInbox');
  var state = { page: 1, pages: 1, filter: 'all', loading: false, unread: 0 };

  var TYPES = {
    WELCOME: { label: 'Informasi akun', icon: 'mail', tone: 'info' },
    TOPUP_APPROVED: { label: 'Top-up disetujui', icon: 'wallet', tone: 'success' },
    TOPUP_REJECTED: { label: 'Top-up ditolak', icon: 'alert', tone: 'danger' },
    BALANCE_RECEIVED: { label: 'Saldo diterima', icon: 'send', tone: 'success' },
    SYSTEM: { label: 'Informasi sistem', icon: 'shield', tone: 'info' }
  };

  function fmtDate(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function setUnread(count) {
    state.unread = Math.max(0, Number(count) || 0);
    unreadLabel.textContent = state.unread.toLocaleString('id-ID') + ' pesan belum dibaca';
    markAllBtn.disabled = state.unread === 0;
    S.setUnread(state.unread);
  }

  function showLoading() {
    list.setAttribute('aria-busy', 'true');
    list.replaceChildren();
    var loading = el('div', 'mailbox-loading');
    loading.append(el('span', 'spinner'), el('span', '', 'Memuat inbox…'));
    list.append(loading);
  }

  function renderEmpty() {
    var box = el('div', 'mailbox-empty');
    var icon = el('div', 'mailbox-empty-icon');
    icon.innerHTML = S.icon('mail', 30);
    var title = state.filter === 'unread' ? 'Tidak ada pesan baru' : state.filter === 'read' ? 'Belum ada pesan dibaca' : 'Inbox masih kosong';
    var desc = state.filter === 'unread'
      ? 'Semua pesan sudah Anda baca. Notifikasi baru akan tampil di sini.'
      : state.filter === 'read'
        ? 'Pesan yang sudah dibaca akan muncul di bagian ini.'
        : 'Notifikasi akun, persetujuan top-up, dan informasi saldo akan tampil di sini.';
    box.append(icon, el('h2', '', title), el('p', '', desc));
    if (state.filter !== 'all') {
      var allBtn = el('button', 'btn btn-ghost btn-sm', 'Lihat semua pesan');
      allBtn.type = 'button';
      allBtn.addEventListener('click', function () { changeFilter('all'); });
      box.append(allBtn);
    }
    list.replaceChildren(box);
    pager.replaceChildren();
  }

  function renderPager(data) {
    pager.replaceChildren();
    if (!data.total || data.pages <= 1) return;
    var info = el('span', '', 'Halaman ' + data.page + ' dari ' + data.pages + ' • ' + data.total.toLocaleString('id-ID') + ' pesan');
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

  function actionButton(label, className, handler) {
    var btn = el('button', 'btn ' + className, label);
    btn.type = 'button';
    btn.addEventListener('click', handler);
    return btn;
  }

  function renderItem(item) {
    var config = TYPES[item.type] || TYPES.SYSTEM;
    var card = el('article', 'mailbox-item' + (item.is_read ? '' : ' is-unread'));
    var icon = el('div', 'mailbox-item-icon mailbox-tone-' + config.tone);
    icon.innerHTML = S.icon(config.icon, 21);

    var content = el('div', 'mailbox-item-content');
    var top = el('div', 'mailbox-item-top');
    var type = el('span', 'mailbox-type mailbox-type-' + config.tone, config.label);
    top.append(type);
    if (!item.is_read) top.append(el('span', 'mailbox-new', 'BARU'));

    var title = el('h2', 'mailbox-item-title', item.title || 'Notifikasi');
    var body = el('p', 'mailbox-item-body', item.body || '');
    var meta = el('div', 'mailbox-item-meta');
    meta.append(el('span', '', fmtDate(item.created_at)));
    if (item.claimed_at) meta.append(el('span', 'mailbox-claimed-note', 'Saldo telah diklaim'));
    content.append(top, title, body, meta);

    var actions = el('div', 'mailbox-item-actions');
    if (item.type === 'TOPUP_APPROVED' && !item.claimed_at) {
      actions.append(actionButton('Klaim saldo', 'btn-primary btn-sm mailbox-claim-btn', function (event) {
        claim(item, event.currentTarget);
      }));
    } else if (item.type === 'TOPUP_APPROVED' && item.claimed_at) {
      actions.append(el('span', 'mailbox-claimed-pill', 'Sudah diklaim'));
    }
    if (!item.is_read) {
      actions.append(actionButton('Tandai dibaca', 'btn-ghost btn-sm', function (event) {
        markRead(item.id, event.currentTarget);
      }));
    }
    if (item.type === 'TOPUP_APPROVED' && !item.claimed_at) {
      actions.append(el('small', 'mailbox-keep-note', 'Klaim saldo sebelum menghapus pesan ini'));
    } else {
      actions.append(actionButton('Hapus', 'btn-ghost btn-sm', function (event) {
        removeMessage(item, event.currentTarget);
      }));
    }

    card.append(icon, content);
    if (actions.childNodes.length) card.append(actions);
    return card;
  }

  function render(items, data) {
    setUnread(data.unread_count);
    if (!items.length) return renderEmpty();

    var wrap = el('div', 'mailbox-items');
    items.forEach(function (item) { wrap.append(renderItem(item)); });
    list.replaceChildren(wrap);
    pager.replaceChildren();
    renderPager(data);
  }

  async function load(page) {
    if (state.loading) return;
    state.loading = true;
    var requestedPage = Math.max(1, page || 1);
    showLoading();
    try {
      var data = await S.api('/inbox?page=' + requestedPage + '&limit=10&filter=' + encodeURIComponent(state.filter));
      if (data.pages > 0 && requestedPage > data.pages) {
        state.loading = false;
        return load(data.pages);
      }
      state.page = data.page || requestedPage;
      state.pages = data.pages || 1;
      render(data.items || [], data);
    } catch (err) {
      list.replaceChildren();
      var box = el('div', 'mailbox-empty mailbox-error');
      box.append(el('h2', '', 'Inbox tidak dapat dimuat'), el('p', '', err.message));
      var retry = el('button', 'btn btn-primary btn-sm', 'Coba lagi');
      retry.type = 'button';
      retry.addEventListener('click', function () { load(requestedPage); });
      box.append(retry);
      list.append(box);
    } finally {
      state.loading = false;
      list.setAttribute('aria-busy', 'false');
    }
  }

  function changeFilter(filter) {
    if (!['all', 'unread', 'read'].includes(filter) || filter === state.filter) return;
    state.filter = filter;
    state.page = 1;
    document.querySelectorAll('[data-filter]').forEach(function (button) {
      var active = button.getAttribute('data-filter') === filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    load(1);
  }

  async function markRead(id, button) {
    button.disabled = true;
    try {
      var result = await S.api('/inbox/' + encodeURIComponent(id) + '/read', { method: 'POST', body: {} });
      setUnread(result.unread_count);
      S.toast('Pesan ditandai sudah dibaca.', 'success');
      await load(state.page);
    } catch (err) {
      S.toast(err.message, 'error');
      button.disabled = false;
    }
  }


  async function removeMessage(item, button) {
    var ok = await S.confirmDialog({
      title: 'Hapus pesan dari Inbox?',
      message: 'Pesan ini akan disembunyikan dari Inbox akun Anda. Tindakan ini tidak menghapus transaksi atau mengubah saldo.',
      confirmText: 'Hapus pesan',
      danger: true
    });
    if (!ok) return;
    button.disabled = true;
    try {
      var result = await S.api('/inbox/' + encodeURIComponent(item.id), { method: 'DELETE' });
      setUnread(result.unread_count);
      S.toast('Pesan dihapus dari Inbox.', 'success');
      await load(state.page);
    } catch (err) {
      S.toast(err.message, 'error');
      button.disabled = false;
    }
  }

  async function markAllRead() {
    if (!state.unread || markAllBtn.disabled) return;
    var ok = await S.confirmDialog({
      title: 'Tandai semua sudah dibaca?',
      message: 'Semua notifikasi yang belum dibaca pada akun ini akan ditandai sudah dibaca.',
      confirmText: 'Tandai semua'
    });
    if (!ok) return;

    markAllBtn.disabled = true;
    try {
      var result = await S.api('/inbox/read-all', { method: 'POST', body: {} });
      setUnread(result.unread_count);
      S.toast((result.marked_count || 0).toLocaleString('id-ID') + ' pesan ditandai sudah dibaca.', 'success');
      await load(state.page);
    } catch (err) {
      S.toast(err.message, 'error');
      markAllBtn.disabled = state.unread === 0;
    }
  }

  async function claim(item, button) {
    var ok = await S.confirmDialog({
      title: 'Klaim saldo virtual?',
      message: 'Saldo dari persetujuan top-up ini akan ditambahkan ke wallet Anda. Klaim hanya dapat dilakukan satu kali.',
      confirmText: 'Klaim saldo'
    });
    if (!ok) return;

    button.disabled = true;
    button.classList.add('loading');
    try {
      var result = await S.api('/inbox/' + encodeURIComponent(item.id) + '/claim', { method: 'POST', body: {} });
      var claimResult = result.claim || {};
      if (claimResult.balance_after !== undefined) S.setBalance(claimResult.balance_after);
      setUnread(result.unread_count);
      S.toast('Saldo ' + S.rupiah(claimResult.amount) + ' berhasil diklaim. Saldo terbaru ' + S.rupiah(claimResult.balance_after) + '.', 'success', 5200);
      await load(state.page);
    } catch (err) {
      S.toast(err.message, 'error');
      await load(state.page);
    }
  }

  document.querySelectorAll('[data-filter]').forEach(function (button) {
    button.addEventListener('click', function () { changeFilter(button.getAttribute('data-filter')); });
  });
  markAllBtn.addEventListener('click', markAllRead);
  refreshBtn.addEventListener('click', function () { load(state.page); });

  (async function start() {
    var me = await S.initShell('mailbox');
    if (!me) return;
    S.fillIcons(document);
    load(1);
  })();
})();
