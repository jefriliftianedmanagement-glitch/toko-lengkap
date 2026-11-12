/* admin.js - kerangka halaman admin (sidebar, top bar, login check) + helper bersama.
   Memakai window.Shop dari /js/app.js. Diekspor sebagai window.Admin */
(function () {
  'use strict';
  var S = window.Shop;
  var el = S.el;

  var NAV = [
    { id: 'dashboard', href: 'index.html', label: 'Dashboard', ic: 'grid' },
    { id: 'products', href: 'products.html', label: 'Produk', ic: 'box' },
    { id: 'inbox', href: 'inbox.html', label: 'Inbox Top-up', ic: 'mail' },
    { id: 'send-balance', href: 'send-balance.html', label: 'Send Balance', ic: 'send' },
    { id: 'transactions', href: 'transactions.html', label: 'Transaksi', ic: 'receipt' },
    { id: 'users', href: 'users.html', label: 'Pengguna', ic: 'users' }
  ];
  var TYPE_LABEL = {
    TOPUP_CLAIM: 'Top-up Claim',
    ADMIN_SEND_BALANCE: 'Admin Send Balance',
    PURCHASE: 'Pembelian Produk'
  };

  // ---------------------------------------------------------------- helper
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '-';
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function pill(text, kind) { return el('span', 'pill pill-' + kind, text); }
  function statusPill(status) {
    var map = {
      SUCCESS: ['Berhasil', 'success'], FAILED: ['Gagal', 'danger'], PENDING: ['Pending', 'warn'],
      APPROVED: ['Disetujui', 'success'], REJECTED: ['Ditolak', 'danger'], CLAIMED: ['Diklaim', 'success'],
      CANCELLED: ['Dibatalkan', 'muted']
    };
    var m = map[status] || [status, 'muted'];
    return pill(m[0], m[1]);
  }
  function typeLabel(t) { return TYPE_LABEL[t] || t; }

  // Kotak status (kosong / error) di dalam sebuah container
  function showState(container, cfg) {
    container.replaceChildren();
    var box = el('div', 'state-box');
    var ic = el('div', 'state-icon' + (cfg.error ? ' error' : ''));
    ic.innerHTML = S.icon(cfg.icon || 'box', 32);
    box.append(ic, el('h2', '', cfg.title), el('p', '', cfg.text || ''));
    if (cfg.label) {
      var b = el('button', 'btn ' + (cfg.error ? 'btn-primary' : 'btn-ghost'), cfg.label);
      b.type = 'button';
      b.addEventListener('click', cfg.onClick);
      box.append(b);
    }
    container.append(box);
  }

  // Pager sederhana: "Halaman x dari y" + tombol sebelumnya/berikutnya
  function renderPager(container, info, onGo) {
    container.replaceChildren();
    if (info.total === 0) return;
    var left = el('span', '', 'Halaman ' + info.page + ' dari ' + info.pages + ' • ' + info.total.toLocaleString('id-ID') + ' data');
    var btns = el('div', 'pager-btns');
    var prev = el('button', 'btn btn-ghost btn-sm', 'Sebelumnya');
    var next = el('button', 'btn btn-ghost btn-sm', 'Berikutnya');
    prev.type = next.type = 'button';
    prev.disabled = info.page <= 1;
    next.disabled = info.page >= info.pages;
    prev.addEventListener('click', function () { onGo(info.page - 1); });
    next.addEventListener('click', function () { onGo(info.page + 1); });
    btns.append(prev, next);
    container.append(left, btns);
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  // ---------------------------------------------------------------- shell
  function build(active, admin) {
    var main = document.querySelector('main');
    var title = main.getAttribute('data-title') || document.title;
    main.classList.add('admin-content');

    var layout = el('div', 'admin-layout');
    var scrim = el('div', 'scrim');

    var side = el('aside', 'sidebar');
    side.id = 'sidebar';
    side.setAttribute('aria-label', 'Menu admin');
    var brand = el('div', 'side-brand');
    brand.innerHTML = '<span class="logo-mark">' + S.icon('shield', 20) + '</span><span>FakeShop</span><small>Admin</small>';
    var nav = el('nav', 'side-nav');
    NAV.forEach(function (n) {
      var a = el('a', 'side-link' + (n.id === active ? ' active' : ''));
      a.href = n.href;
      if (n.id === active) a.setAttribute('aria-current', 'page');
      a.innerHTML = S.icon(n.ic, 20);
      a.append(el('span', '', n.label));
      nav.append(a);
    });

    var foot = el('div', 'side-foot');
    var user = el('div', 'side-user');
    var av = el('span', 'avatar', (admin.username || '?').charAt(0).toUpperCase());
    av.style.background = 'linear-gradient(135deg, var(--accent), var(--accent-2))';
    var who = el('div');
    who.append(el('b', '', admin.username), el('small', '', 'Administrator'));
    user.append(av, who);
    var out = el('button', 'btn btn-ghost btn-block', 'Keluar');
    out.type = 'button';
    out.addEventListener('click', function () {
      S.confirmDialog({ title: 'Keluar dari admin?', message: 'Anda perlu login lagi untuk mengelola toko.', confirmText: 'Keluar', danger: true })
        .then(function (ok) { if (ok) logout(); });
    });
    foot.append(user, out);
    side.append(brand, nav, foot);

    var wrap = el('div', 'admin-main');
    var top = el('header', 'admin-top');
    var left = el('div', 'top-left');
    var menuBtn = el('button', 'icon-btn menu-btn');
    menuBtn.type = 'button';
    menuBtn.setAttribute('aria-label', 'Buka menu');
    menuBtn.setAttribute('aria-controls', 'sidebar');
    menuBtn.innerHTML = S.icon('menu', 20);
    left.append(menuBtn, el('h1', '', title));

    var right = el('div', 'top-right');
    var themeBtn = el('button', 'icon-btn');
    themeBtn.type = 'button';
    themeBtn.setAttribute('aria-label', 'Ganti tema');
    function paintTheme() { themeBtn.innerHTML = S.icon(currentTheme() === 'dark' ? 'sun' : 'moon', 20); }
    paintTheme();
    themeBtn.addEventListener('click', function () { S.toggleTheme(); paintTheme(); });
    var chip = el('div', 'top-chip');
    chip.append(el('span', 'avatar', (admin.username || '?').charAt(0).toUpperCase()), el('span', '', admin.username));
    chip.firstChild.style.cssText = 'width:34px;height:34px;font-size:.85rem;background:linear-gradient(135deg,var(--accent),var(--accent-2))';
    right.append(themeBtn, chip);
    top.append(left, right);

    document.body.prepend(layout);
    layout.append(scrim, side, wrap);
    wrap.append(top, main); // <main> dipindahkan ke dalam layout

    function setOpen(open) {
      side.classList.toggle('open', open);
      scrim.classList.toggle('show', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    }
    menuBtn.addEventListener('click', function () { setOpen(!side.classList.contains('open')); });
    scrim.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  async function logout() {
    try { await S.api('/admin/auth/logout', { method: 'POST', redirectOn401: false }); } catch (e) { /* lanjut */ }
    location.replace('login.html');
  }

  // Dipanggil setiap halaman admin. Jika belum login admin -> dialihkan ke login.html
  async function initShell(active) {
    var admin;
    try {
      admin = (await S.api('/admin/auth/me')).admin;
    } catch (e) {
      if (e.status !== 401) {
        var m = document.querySelector('main') || document.body;
        m.replaceChildren();
        showState(m, { error: true, icon: 'alert', title: 'Gagal memuat halaman', text: e.message, label: 'Coba lagi', onClick: function () { location.reload(); } });
      }
      return null;
    }
    build(active, admin);
    return admin;
  }

  window.Admin = {
    initShell: initShell, fmtDate: fmtDate, pill: pill, statusPill: statusPill, typeLabel: typeLabel,
    showState: showState, renderPager: renderPager
  };
})();
