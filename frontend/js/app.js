/* =====================================================================
   app.js - modul bersama semua halaman user (tema, API, toast, modal, header)
   Diekspor sebagai window.Shop
   ===================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- tema
  var THEME_KEY = 'shop_theme';
  function savedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  function applyTheme(t) {
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* abaikan */ }
    applyTheme(next);
    return next;
  }
  applyTheme(savedTheme()); // diterapkan secepat mungkin agar tidak berkedip

  // --------------------------------------------------------------- util
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function rupiah(n) {
    var v = Math.trunc(Number(n) || 0);
    return 'Rp' + v.toLocaleString('id-ID');
  }

  // -------------------------------------------------------------- ikon
  var P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.6A17 17 0 002 12s4 7 10 7c1.7 0 3.2-.4 4.6-1"/>',
    logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    bag: '<path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 016 0"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    searchX: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8.5 8.5l5 5M13.5 8.5l-5 5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.5 3.3-5.5 6.5-5.5s5.8 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
    wallet: '<path d="M3 7a2 2 0 012-2h13v4"/><path d="M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>'
  };
  function icon(name, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  function fillIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (n) {
      n.innerHTML = icon(n.getAttribute('data-icon'), Number(n.getAttribute('data-size')) || 28);
    });
  }

  // --------------------------------------------------------------- API
  function ApiError(status, code, message) {
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.message = message;
  }
  ApiError.prototype = Object.create(Error.prototype);

  function goLogin() {
    var p = location.pathname;
    if (/\/(login|register)\.html$/.test(p)) return;
    location.replace('login.html');
  }

  // Semua request membawa header X-Requested-With (wajib untuk POST, anti-CSRF)
  async function api(path, opts) {
    opts = opts || {};
    var res;
    try {
      // opts.raw = Blob/ArrayBuffer (upload file mentah), selain itu body dikirim sebagai JSON
      var payload = opts.raw !== undefined ? opts.raw : (opts.body !== undefined ? JSON.stringify(opts.body) : undefined);
      res = await fetch('/api' + path, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': opts.contentType || 'application/json', 'X-Requested-With': 'fetch' },
        body: payload,
        credentials: 'same-origin'
      });
    } catch (e) {
      throw new ApiError(0, 'NETWORK', 'Tidak dapat terhubung ke server. Periksa koneksi Anda.');
    }
    var data = null;
    try { data = await res.json(); } catch (e) { /* body kosong */ }
    if (res.ok && data && data.ok) return data;

    var err = (data && data.error) || { code: 'UNKNOWN', message: 'Terjadi kesalahan. Coba lagi.' };
    if (res.status === 401 && opts.redirectOn401 !== false) goLogin();
    throw new ApiError(res.status, err.code, err.message);
  }

  // -------------------------------------------------------------- toast
  function toast(message, type, ms) {
    var box = document.getElementById('toasts');
    if (!box) {
      box = el('div');
      box.id = 'toasts';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    var t = el('div', 'toast toast-' + (type || 'info'), message);
    box.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 260);
    }, ms || 3500);
  }

  // -------------------------------------------------------------- modal
  var scrollLocks = 0;
  var modalSeq = 0;

  function openModal(cfg) {
    var prevFocus = document.activeElement;
    var closed = false;
    var overlay = el('div', 'modal-overlay');
    var dlg = el('div', 'modal');
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    dlg.tabIndex = -1;

    var head = el('div', 'modal-head');
    var h = el('h2', 'modal-title', cfg.title || '');
    h.id = 'modalTitle' + (++modalSeq);
    dlg.setAttribute('aria-labelledby', h.id);
    var closeBtn = el('button', 'icon-btn plain');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Tutup');
    closeBtn.innerHTML = icon('x', 20);
    head.append(h, closeBtn);

    var content = el('div', 'modal-body');
    if (cfg.body) content.append(cfg.body);
    dlg.append(head, content);

    var handle = { el: dlg, close: close };

    if (cfg.actions && cfg.actions.length) {
      var foot = el('div', 'modal-foot');
      cfg.actions.forEach(function (a) {
        var b = el('button', 'btn ' + (a.className || 'btn-ghost'), a.label);
        b.type = 'button';
        b.addEventListener('click', function () { if (a.onClick) a.onClick(handle); else close(); });
        foot.append(b);
      });
      dlg.append(foot);
    }

    function onKey(e) { if (e.key === 'Escape') close(); }
    function close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('show');
      setTimeout(function () { overlay.remove(); }, 220);
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.classList.remove('no-scroll');
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (cfg.onClose) cfg.onClose(result);
    }

    closeBtn.addEventListener('click', function () { close(); });
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    overlay.append(dlg);
    document.body.append(overlay);
    scrollLocks++;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(function () { overlay.classList.add('show'); dlg.focus(); });
    return handle;
  }

  // Dialog konfirmasi -> Promise<boolean>
  function confirmDialog(cfg) {
    return new Promise(function (resolve) {
      var body = el('p', '', cfg.message || '');
      body.style.margin = '4px 0 8px';
      openModal({
        title: cfg.title || 'Konfirmasi',
        body: body,
        onClose: function (r) { resolve(r === true); },
        actions: [
          { label: cfg.cancelText || 'Batal', className: 'btn-ghost', onClick: function (m) { m.close(false); } },
          { label: cfg.confirmText || 'Ya, lanjut', className: cfg.danger ? 'btn-danger' : 'btn-primary', onClick: function (m) { m.close(true); } }
        ]
      });
    });
  }

  // --------------------------------------------------------- shell/header
  var shell = { user: null, active: '' };

  function setBalance(n) {
    var node = document.getElementById('balanceValue');
    if (node) node.textContent = rupiah(n);
    if (shell.user) shell.user.balance = n;
  }
  function setUnread(n) {
    ['inboxBadge', 'navBadge'].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      b.textContent = n > 99 ? '99+' : String(n);
      b.hidden = !(n > 0);
    });
  }
  function avatarStyle(node, user) {
    var hue = Number(String(user.account_id).slice(-3)) % 360;
    node.style.background = 'linear-gradient(135deg, hsl(' + hue + ' 75% 55%), hsl(' + ((hue + 45) % 360) + ' 75% 48%))';
    node.textContent = (user.username || '?').charAt(0).toUpperCase();
  }

  function openAccount() {
    var u = shell.user;
    var body = el('div');

    var top = el('div', 'account-top');
    var av = el('div', 'avatar lg');
    avatarStyle(av, u);
    top.append(av, el('h3', '', '@' + u.username));

    var rowId = el('div', 'kv');
    rowId.append(el('span', '', 'ID Akun'));
    var idWrap = el('span');
    idWrap.style.cssText = 'display:flex;align-items:center;gap:8px';
    var idVal = el('strong', '', String(u.account_id));
    var copyBtn = el('button', 'icon-btn');
    copyBtn.type = 'button';
    copyBtn.style.cssText = 'width:34px;height:34px';
    copyBtn.setAttribute('aria-label', 'Salin ID akun');
    copyBtn.innerHTML = icon('copy', 16);
    copyBtn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(u.account_id)).then(
          function () { toast('ID akun disalin', 'success'); },
          function () { toast('Gagal menyalin ID', 'error'); }
        );
      } else toast('Browser tidak mendukung salin otomatis', 'error');
    });
    idWrap.append(idVal, copyBtn);
    rowId.append(idWrap);

    var rowBal = el('div', 'kv');
    rowBal.append(el('span', '', 'Saldo virtual'), el('strong', '', rupiah(u.balance)));

    var rowTheme = el('div', 'kv');
    rowTheme.append(el('span', '', 'Tampilan'));
    var themeBtn = el('button', 'btn btn-ghost btn-sm');
    themeBtn.type = 'button';
    function paintTheme() {
      var dark = currentTheme() === 'dark';
      themeBtn.innerHTML = icon(dark ? 'sun' : 'moon', 16) + '<span>' + (dark ? 'Mode terang' : 'Mode gelap') + '</span>';
    }
    paintTheme();
    themeBtn.addEventListener('click', function () { toggleTheme(); paintTheme(); });
    rowTheme.append(themeBtn);

    body.append(top, rowId, rowBal, rowTheme);

    openModal({
      title: 'Akun saya',
      body: body,
      actions: [
        { label: 'Tutup', className: 'btn-ghost' },
        {
          label: 'Keluar', className: 'btn-danger',
          onClick: function (m) {
            m.close();
            confirmDialog({ title: 'Keluar dari akun?', message: 'Anda perlu login lagi untuk mengakses toko.', confirmText: 'Keluar', danger: true })
              .then(function (ok) { if (ok) logout(); });
          }
        }
      ]
    });
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST', redirectOn401: false }); } catch (e) { /* tetap lanjut */ }
    location.replace('login.html');
  }

  function renderShell(active, me) {
    var header = el('header', 'app-header');
    header.innerHTML =
      '<div class="header-inner">' +
        '<a class="logo" href="dashboard.html" aria-label="Beranda"><span class="logo-mark">' + icon('bag', 20) + '</span><span class="logo-text">FakeShop</span></a>' +
        '<form class="search" id="searchForm" role="search">' + icon('search', 18) +
          '<label class="sr-only" for="searchInput">Cari produk</label>' +
          '<input id="searchInput" type="search" placeholder="Cari produk…" maxlength="100" autocomplete="off" enterkeyhint="search">' +
        '</form>' +
        '<div class="header-actions">' +
          '<nav class="desktop-nav" aria-label="Navigasi utama">' +
            '<a href="dashboard.html" data-nav="dashboard">Beranda</a>' +
            '<a href="history.html" data-nav="history">Riwayat</a>' +
          '</nav>' +
          '<div class="balance"><div class="balance-text"><small>Saldo</small><strong id="balanceValue">Rp0</strong></div>' +
            '<a class="add" href="topup.html" aria-label="Top-up saldo">' + icon('plus', 18) + '</a></div>' +
          '<a class="icon-btn" href="mailbox.html" aria-label="Inbox">' + icon('mail', 20) + '<span class="badge" id="inboxBadge" hidden>0</span></a>' +
          '<button class="profile-chip" id="profileBtn" type="button" aria-label="Akun saya">' +
            '<span class="avatar" id="avatar"></span>' +
            '<span class="profile-text"><b id="hdrUsername"></b><small id="hdrId"></small></span>' +
          '</button>' +
        '</div>' +
      '</div>';

    var items = [
      { id: 'dashboard', href: 'dashboard.html', label: 'Beranda', ic: 'home' },
      { id: 'mailbox', href: 'mailbox.html', label: 'Inbox', ic: 'mail' },
      { id: 'history', href: 'history.html', label: 'Riwayat', ic: 'clock' }
    ];
    var nav = el('nav', 'bottom-nav');
    nav.setAttribute('aria-label', 'Navigasi bawah');
    nav.innerHTML = items.map(function (i) {
      return '<a href="' + i.href + '"' + (i.id === active ? ' class="active" aria-current="page"' : '') + '>' +
        icon(i.ic, 22) + '<span>' + i.label + '</span>' +
        (i.id === 'mailbox' ? '<span class="badge" id="navBadge" hidden>0</span>' : '') + '</a>';
    }).join('') + '<button type="button" id="navAccount">' + icon('user', 22) + '<span>Akun</span></button>';

    document.body.prepend(header);
    document.body.append(nav);

    // data pengguna dimasukkan lewat textContent (aman dari XSS)
    avatarStyle(document.getElementById('avatar'), me);
    document.getElementById('hdrUsername').textContent = '@' + me.username;
    document.getElementById('hdrId').textContent = 'ID ' + me.account_id;
    header.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === active) a.classList.add('active');
    });
    setBalance(me.balance);
    setUnread(me.unread_count || 0);

    document.getElementById('profileBtn').addEventListener('click', openAccount);
    document.getElementById('navAccount').addEventListener('click', openAccount);

    // pencarian: di dashboard memicu event, di halaman lain berpindah ke dashboard
    var input = document.getElementById('searchInput');
    var form = document.getElementById('searchForm');
    var timer;
    function emit(q) { document.dispatchEvent(new CustomEvent('shop:search', { detail: { q: q.trim() } })); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (active === 'dashboard') emit(q);
      else location.href = 'dashboard.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    input.addEventListener('input', function () {
      if (active !== 'dashboard') return;
      clearTimeout(timer);
      timer = setTimeout(function () { emit(input.value); }, 350);
    });
    if (active === 'dashboard') {
      var q0 = new URLSearchParams(location.search).get('q');
      if (q0) input.value = q0.slice(0, 100);
    }
  }

  function fatalError(message) {
    var main = document.querySelector('main') || document.body;
    main.replaceChildren();
    var box = el('div', 'state-box');
    var ic = el('div', 'state-icon error');
    ic.innerHTML = icon('alert', 32);
    var btn = el('button', 'btn btn-primary', 'Coba lagi');
    btn.type = 'button';
    btn.addEventListener('click', function () { location.reload(); });
    box.append(ic, el('h2', '', 'Gagal memuat halaman'), el('p', '', message), btn);
    main.append(box);
  }

  // Dipanggil oleh setiap halaman yang butuh login. Mengembalikan data user,
  // atau null jika gagal (halaman sudah menampilkan pesan / mengalihkan ke login).
  async function initShell(active) {
    var me;
    try {
      me = (await api('/auth/me')).user;
    } catch (e) {
      if (e.status !== 401) fatalError(e.message);
      return null;
    }
    shell.user = me;
    shell.active = active;
    renderShell(active, me);

    try {
      var flash = sessionStorage.getItem('shop_flash');
      if (flash) {
        sessionStorage.removeItem('shop_flash');
        var f = JSON.parse(flash);
        toast(f.message, f.type || 'success', 6000);
      }
    } catch (e) { /* abaikan */ }
    return me;
  }

  document.addEventListener('DOMContentLoaded', function () { fillIcons(); });

  window.Shop = {
    api: api, ApiError: ApiError, toast: toast, openModal: openModal, confirmDialog: confirmDialog,
    initShell: initShell, setBalance: setBalance, setUnread: setUnread,
    el: el, icon: icon, fillIcons: fillIcons, rupiah: rupiah, toggleTheme: toggleTheme, logout: logout,
    get user() { return shell.user; }
  };
})();
