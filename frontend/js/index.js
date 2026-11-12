/* index.js - arahkan ke dashboard jika sudah login, selain itu ke halaman login */
(function () {
  'use strict';
  window.Shop.api('/auth/me', { redirectOn401: false })
    .then(function () { location.replace('dashboard.html'); })
    .catch(function () { location.replace('login.html'); });
})();
