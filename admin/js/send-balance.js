/* send-balance.js - PART 7: pengiriman saldo virtual langsung oleh admin */
(function () {
  'use strict';
  var S = window.Shop;
  var A = window.Admin;
  var el = S.el;

  var form = document.getElementById('sendForm');
  var accountInput = document.getElementById('accountId');
  var lookupBtn = document.getElementById('lookupBtn');
  var amountInput = document.getElementById('amount');
  var noteInput = document.getElementById('note');
  var sendBtn = document.getElementById('sendBtn');
  var recipientCard = document.getElementById('recipientCard');
  var recipientAvatar = document.getElementById('recipientAvatar');
  var recipientName = document.getElementById('recipientName');
  var recipientMeta = document.getElementById('recipientMeta');
  var recipientBalance = document.getElementById('recipientBalance');
  var recipientStatus = document.getElementById('recipientStatus');
  var lookupState = document.getElementById('lookupState');
  var amountPreview = document.getElementById('amountPreview');
  var noteCount = document.getElementById('noteCount');
  var sendResult = document.getElementById('sendResult');
  var resultText = document.getElementById('resultText');
  var resultCode = document.getElementById('resultCode');

  var state = { recipient: null, lookupSeq: 0, sending: false, confirming: false, lookingUp: false };

  function cleanDigits(value, maxLength) {
    return String(value || '').replace(/\D/g, '').slice(0, maxLength);
  }

  function rupiah(value) { return S.rupiah(value); }

  function currentAmount() {
    var raw = amountInput.value.trim();
    if (!/^\d{1,13}$/.test(raw)) return 0;
    var amount = Number(raw);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000000) return 0;
    return amount;
  }

  function updateSendState() {
    var ready = !!state.recipient && state.recipient.is_active &&
      String(state.recipient.account_id) === accountInput.value && currentAmount() > 0 &&
      !state.sending && !state.confirming && !state.lookingUp;
    sendBtn.disabled = !ready;
    amountPreview.textContent = rupiah(currentAmount());
  }

  function clearRecipient(message) {
    state.recipient = null;
    recipientCard.hidden = true;
    if (message) lookupState.textContent = message;
    lookupState.classList.remove('is-error', 'is-success');
    updateSendState();
  }

  function showLookupMessage(message, kind) {
    lookupState.textContent = message;
    lookupState.classList.remove('is-error', 'is-success');
    if (kind) lookupState.classList.add(kind === 'error' ? 'is-error' : 'is-success');
  }

  function renderRecipient(user) {
    state.recipient = user;
    recipientAvatar.textContent = (user.username || '?').charAt(0).toUpperCase();
    recipientAvatar.style.background = 'linear-gradient(135deg, var(--accent), var(--accent-2))';
    recipientName.textContent = '@' + user.username;
    recipientMeta.textContent = 'ID akun ' + String(user.account_id);
    recipientBalance.textContent = 'Saldo saat ini: ' + rupiah(user.balance);
    recipientStatus.textContent = user.is_active ? 'Aktif' : 'Nonaktif';
    recipientStatus.className = 'send-recipient-status ' + (user.is_active ? 'is-active' : 'is-inactive');
    recipientCard.hidden = false;
    showLookupMessage(user.is_active ? 'Penerima terverifikasi. Periksa kembali detail sebelum mengirim.' : 'Akun ini nonaktif dan tidak dapat menerima saldo.', user.is_active ? 'success' : 'error');
    updateSendState();
  }

  async function lookupRecipient() {
    var accountId = accountInput.value.trim();
    state.lookupSeq += 1;
    var seq = state.lookupSeq;
    if (!/^[1-9]\d{9}$/.test(accountId)) {
      clearRecipient('ID akun harus tepat 10 digit angka.');
      showLookupMessage('ID akun harus tepat 10 digit angka.', 'error');
      accountInput.focus();
      return;
    }

    state.lookingUp = true;
    clearRecipient('Memeriksa ID akun…');
    state.lookingUp = true;
    lookupBtn.disabled = true;
    lookupBtn.classList.add('loading');
    updateSendState();
    try {
      var query = new URLSearchParams({ q: accountId, page: '1', limit: '1' });
      var data = await S.api('/admin/users?' + query.toString());
      if (seq !== state.lookupSeq || accountInput.value !== accountId) return;
      var user = (data.items || []).find(function (item) { return String(item.account_id) === accountId; });
      if (!user) {
        clearRecipient('Akun tidak ditemukan. Periksa kembali ID akun yang dimasukkan.');
        showLookupMessage('Akun tidak ditemukan. Periksa kembali ID akun yang dimasukkan.', 'error');
        return;
      }
      renderRecipient(user);
    } catch (err) {
      if (seq !== state.lookupSeq) return;
      clearRecipient(err.message || 'Tidak dapat memeriksa akun.');
      showLookupMessage(err.message || 'Tidak dapat memeriksa akun.', 'error');
    } finally {
      if (seq === state.lookupSeq) {
        state.lookingUp = false;
        lookupBtn.disabled = false;
        lookupBtn.classList.remove('loading');
        updateSendState();
      }
    }
  }

  accountInput.addEventListener('input', function () {
    var cleaned = cleanDigits(accountInput.value, 10);
    if (cleaned !== accountInput.value) accountInput.value = cleaned;
    state.lookupSeq += 1;
    state.lookingUp = false;
    lookupBtn.disabled = false;
    lookupBtn.classList.remove('loading');
    clearRecipient('ID akun berubah. Periksa kembali ID sebelum mengirim.');
  });

  accountInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      lookupRecipient();
    }
  });
  lookupBtn.addEventListener('click', lookupRecipient);

  amountInput.addEventListener('input', function () {
    var cleaned = cleanDigits(amountInput.value, 13);
    if (cleaned !== amountInput.value) amountInput.value = cleaned;
    updateSendState();
  });

  noteInput.addEventListener('input', function () {
    noteCount.textContent = String(noteInput.value.length);
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var recipient = state.recipient;
    var amount = currentAmount();
    var accountId = accountInput.value;
    var note = noteInput.value.trim();

    if (!recipient || !recipient.is_active || String(recipient.account_id) !== accountId) {
      S.toast('Periksa ID akun penerima terlebih dahulu.', 'error');
      return;
    }
    if (!amount) {
      S.toast('Masukkan nominal bilangan bulat yang valid.', 'error');
      amountInput.focus();
      return;
    }
    if (note.length > 250) {
      S.toast('Catatan maksimal 250 karakter.', 'error');
      noteInput.focus();
      return;
    }

    state.confirming = true;
    updateSendState();
    var confirmed = await S.confirmDialog({
      title: 'Konfirmasi pengiriman saldo',
      message: 'Kirim ' + rupiah(amount) + ' kepada @' + recipient.username + ' (ID ' + accountId + ')? Saldo akan langsung bertambah dan pengiriman yang berhasil tidak dapat dibatalkan.',
      confirmText: 'Ya, kirim saldo'
    });
    state.confirming = false;
    if (!confirmed || state.sending) { updateSendState(); return; }
    if (accountInput.value !== accountId || state.recipient !== recipient || currentAmount() !== amount || noteInput.value.trim() !== note) {
      updateSendState();
      S.toast('Detail pengiriman berubah saat konfirmasi. Periksa kembali sebelum mengirim.', 'error');
      return;
    }

    state.sending = true;
    sendBtn.disabled = true;
    sendBtn.classList.add('loading');
    sendBtn.textContent = 'Mengirim saldo';
    try {
      var data = await S.api('/admin/send-balance', {
        method: 'POST',
        body: { account_id: accountId, amount: amount, note: note }
      });
      var result = data.result || {};
      recipient.balance = result.balance_after;
      recipientBalance.textContent = 'Saldo terbaru: ' + rupiah(result.balance_after);
      resultText.textContent = rupiah(result.amount) + ' berhasil dikirim kepada @' + result.username + ' (ID ' + result.account_id + ').';
      resultCode.textContent = 'Kode transaksi: ' + (result.transaction_code || '-');
      sendResult.hidden = false;
      S.toast('Saldo berhasil dikirim dan notifikasi telah dibuat.', 'success', 5000);
      amountInput.value = '';
      noteInput.value = '';
      noteCount.textContent = '0';
      amountPreview.textContent = rupiah(0);
      updateSendState();
      sendResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      S.toast(err.message || 'Pengiriman saldo gagal.', 'error', 5000);
    } finally {
      state.sending = false;
      sendBtn.classList.remove('loading');
      sendBtn.textContent = 'Kirim saldo';
      updateSendState();
    }
  });

  (async function start() {
    var admin = await A.initShell('send-balance');
    if (!admin) return;
    updateSendState();
  })();
})();
