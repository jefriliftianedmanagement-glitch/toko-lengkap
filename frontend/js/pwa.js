/* PWA registration and install affordance. No account data is stored here. */
(function () {
  'use strict';
  var deferredPrompt = null;

  function addInstallButton() {
    if (document.getElementById('pwaInstallBtn')) return;
    var button = document.createElement('button');
    button.id = 'pwaInstallBtn';
    button.type = 'button';
    button.className = 'pwa-install-btn';
    button.textContent = 'Install aplikasi';
    button.hidden = true;
    button.addEventListener('click', async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      var choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      button.hidden = true;
      if (choice && choice.outcome === 'accepted') button.textContent = 'Aplikasi terpasang';
    });
    document.body.appendChild(button);
    return button;
  }

  function init() {
    var button = addInstallButton();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (error) {
        console.warn('[PWA] Service worker gagal didaftarkan:', error && error.message ? error.message : error);
      });
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      if (button) button.hidden = false;
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      if (button) button.hidden = true;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
