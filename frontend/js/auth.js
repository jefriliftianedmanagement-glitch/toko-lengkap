/* auth.js - logika form login.html dan register.html */
(function () {
  'use strict';
  var S = window.Shop;
  var form = document.getElementById('authForm');
  if (!form) return;

  var mode = form.getAttribute('data-mode'); // "login" | "register"
  var errBox = document.getElementById('formError');
  var btn = document.getElementById('submitBtn');
  var btnLabel = btn.textContent;

  // Jika sudah login, langsung ke toko
  S.api('/auth/me', { redirectOn401: false })
    .then(function () { location.replace('dashboard.html'); })
    .catch(function () { /* belum login: tetap di halaman ini */ });

  // tombol tema
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.innerHTML = S.icon('moon', 20);
    themeBtn.addEventListener('click', function () { S.toggleTheme(); });
  }

  // tampil/sembunyi password
  document.querySelectorAll('.pw-toggle').forEach(function (b) {
    b.innerHTML = S.icon('eye', 20);
    b.addEventListener('click', function () {
      var input = document.getElementById(b.getAttribute('data-target'));
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.innerHTML = S.icon(show ? 'eyeOff' : 'eye', 20);
      b.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
    });
  });

  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }
  function setLoading(on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.textContent = on ? '' : btnLabel;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errBox.hidden = true;

    var username = form.elements.username.value.trim().replace(/^@/, '');
    var password = form.elements.password.value;

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return showError('Username 3-20 karakter: hanya huruf, angka, dan underscore.');
    }
    if (mode === 'register') {
      if (password.length < 8) return showError('Password minimal 8 karakter.');
      if (new TextEncoder().encode(password).length > 72) return showError('Password terlalu panjang (maks 72 byte).');
      if (password !== form.elements.confirm.value) return showError('Konfirmasi password tidak sama.');
    } else if (!password) {
      return showError('Password wajib diisi.');
    }

    setLoading(true);
    try {
      var data = await S.api('/auth/' + mode, {
        method: 'POST',
        body: { username: username, password: password },
        redirectOn401: false
      });
      if (mode === 'register') {
        try {
          sessionStorage.setItem('shop_flash', JSON.stringify({
            type: 'success',
            message: 'Akun dibuat! ID akun Anda: ' + data.user.account_id
          }));
        } catch (err) { /* abaikan */ }
      }
      location.replace('dashboard.html');
    } catch (err) {
      showError(err.message);
      setLoading(false);
    }
  });
})();
