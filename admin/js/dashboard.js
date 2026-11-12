/* dashboard.js (admin) - statistik + transaksi terbaru */
(function () {
  'use strict';
  var S = window.Shop, A = window.Admin, el = S.el;

  var statsBox = document.getElementById('stats');
  var recentBox = document.getElementById('recent');

  function skeletons() {
    statsBox.replaceChildren();
    for (var i = 0; i < 5; i++) {
      var s = el('div', 'stat skeleton');
      s.innerHTML = '<div class="sk" style="width:46px;height:46px;border-radius:15px"></div>' +
        '<div style="flex:1"><div class="sk sk-line w50"></div><div class="sk sk-line w70" style="height:20px;margin-top:8px"></div></div>';
      statsBox.append(s);
    }
  }

  function statCard(o) {
    var c = el(o.href ? 'a' : 'div', 'stat' + (o.cls ? ' ' + o.cls : ''));
    if (o.href) c.href = o.href;
    var ic = el('div', 'stat-icon');
    ic.innerHTML = S.icon(o.icon, 22);
    var body = el('div', 'stat-body');
    body.append(el('small', '', o.label), el('strong', '', o.value));
    if (o.note) body.append(el('em', '', o.note));
    c.append(ic, body);
    return c;
  }

  function renderStats(st) {
    statsBox.replaceChildren(
      statCard({ icon: 'users', label: 'Total pengguna', value: Number(st.total_users).toLocaleString('id-ID') }),
      statCard({ icon: 'box', label: 'Total produk', value: Number(st.total_products).toLocaleString('id-ID'), note: Number(st.active_products).toLocaleString('id-ID') + ' aktif' }),
      statCard({ icon: 'mail', label: 'Total request top-up', value: Number(st.total_topups).toLocaleString('id-ID') }),
      statCard({ icon: 'wallet', label: 'Saldo virtual beredar', value: S.rupiah(st.total_balance), cls: 'good' }),
      statCard({
        icon: 'clock', label: 'Top-up pending', value: Number(st.pending_topups).toLocaleString('id-ID'),
        cls: st.pending_topups > 0 ? 'warn' : '', href: 'inbox.html', note: st.pending_topups > 0 ? 'Perlu ditinjau' : 'Tidak ada antrean'
      })
    );
  }

  function renderRecent(list) {
    recentBox.replaceChildren();
    if (!list.length) {
      A.showState(recentBox, { icon: 'receipt', title: 'Belum ada transaksi', text: 'Transaksi akan muncul setelah ada klaim top-up atau pengiriman saldo.' });
      return;
    }
    var wrap = el('div', 'table-wrap');
    var table = el('table', 'data');
    var thead = el('thead');
    var hr = el('tr');
    ['Waktu', 'Pengguna', 'Jenis', 'Nominal', 'Status', 'ID Transaksi'].forEach(function (h, i) {
      var th = el('th', i === 3 ? 'num' : '', h);
      if (i === 5) th.className = 'hide-sm';
      hr.append(th);
    });
    thead.append(hr);
    var tbody = el('tbody');
    list.forEach(function (t) {
      var tr = el('tr');
      var tdT = el('td', '', A.fmtDate(t.created_at));
      tdT.style.whiteSpace = 'nowrap';
      var tdU = el('td', 'cell-user');
      tdU.append(el('b', '', t.username ? '@' + t.username : '-'), el('small', '', t.account_id ? 'ID ' + t.account_id : ''));
      var tdJ = el('td', '', A.typeLabel(t.type));
      var tdN = el('td', 'num', S.rupiah(t.amount));
      var tdS = el('td');
      tdS.append(A.statusPill(t.status));
      var tdC = el('td', 'mono hide-sm', t.transaction_code);
      tr.append(tdT, tdU, tdJ, tdN, tdS, tdC);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    recentBox.append(wrap);
  }

  async function load() {
    skeletons();
    recentBox.replaceChildren();
    try {
      var data = await S.api('/admin/dashboard');
      renderStats(data.stats);
      renderRecent(data.recent);
    } catch (e) {
      statsBox.replaceChildren();
      A.showState(recentBox, { error: true, icon: 'alert', title: 'Gagal memuat dashboard', text: e.message, label: 'Coba lagi', onClick: load });
    }
  }

  (async function start() {
    var admin = await A.initShell('dashboard');
    if (!admin) return;
    load();
  })();
})();
