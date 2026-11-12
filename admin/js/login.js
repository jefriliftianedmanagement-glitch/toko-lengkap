/* login.js - form login admin */
(function () {
  'use strict';
  var S = window.Shop;
  var form = document.getElementById('authForm');
  var errBox = document.getElementById('formError');
  var btn = document.getElementById('submitBtn');
  var label = btn.textContent;

  // sudah login admin -> langsung ke dashboard
  S.api('/admin/auth/me', { redirectOn401: false })
    .then(function () { location.replace('index.html'); })
    .catch(function () { /* belum login */ });

  var themeBtn = document.getElementById('themeBtn');
  themeBtn.innerHTML = S.icon('moon', 20);
  themeBtn.addEventListener('click', function () { S.toggleTheme(); });

  var tg = document.querySelector('.pw-toggle');
  tg.innerHTML = S.icon('eye', 20);
  tg.addEventListener('click', function () {
    var input = document.getElementById('password');
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    tg.innerHTML = S.icon(show ? 'eyeOff' : 'eye', 20);
    tg.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
  });

  function showError(msg) { errBox.textContent = msg; errBox.hidden = false; }
  function setLoading(on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.textContent = on ? '' : label;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errBox.hidden = true;
    var username = form.elements.username.value.trim();
    var password = form.elements.password.value;
    if (!username || !password) return showError('Username dan password wajib diisi.');

    setLoading(true);
    try {
      await S.api('/admin/auth/login', { method: 'POST', body: { username: username, password: password }, redirectOn401: false });
      location.replace('index.html');
    } catch (err) {
      showError(err.message);
      setLoading(false);
    }
  });
})();
