// External file (not inline): the frontends nginx CSP is script-src 'self'.
(function () {
  var btn = document.getElementById('play');
  var content = document.getElementById('content');
  var blocked = document.getElementById('blocked');
  var blockLabel = document.getElementById('block-label');
  var blockTitle = document.getElementById('block-title');
  var blockBody = document.getElementById('block-body');
  var blockMsg = document.getElementById('block-msg');

  function showBlocked(opts) {
    content.classList.add('hidden');
    blocked.classList.add('visible');
    if (opts.maintenance) {
      document.body.classList.add('maintenance');
      blockLabel.hidden = false;
      blockTitle.textContent = 'Waiter landing is under maintenance';
      blockBody.textContent =
        'Cullinos is performing maintenance. Please try again shortly.';
    } else {
      document.body.classList.remove('maintenance');
      blockLabel.hidden = true;
      blockTitle.textContent = 'Waiter landing is turned off';
      blockBody.textContent =
        'Cullinos has temporarily turned off the waiter download page.';
    }
    blockMsg.textContent = opts.message || '';
  }

  function loadPlayStore() {
    fetch('https://api.cullinos.com/api/v1/public/marketplace/app-config')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (body) {
        if (!body || !body.waiterPlayStoreUrl) return;
        btn.href = body.waiterPlayStoreUrl;
        btn.textContent = 'Download on Google Play';
        btn.classList.remove('disabled');
        btn.removeAttribute('aria-disabled');
      })
      .catch(function () {});
  }

  fetch('https://api.cullinos.com/api/v1/public/portal-status', {
    headers: { 'X-Cullinos-Portal': 'waiter_landing' },
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (status) {
      if (!status || !status.portals) {
        loadPlayStore();
        return;
      }
      var entry = status.portals.waiter_landing;
      if (entry && entry.enabled === false) {
        showBlocked({ maintenance: false, message: status.message || '' });
        return;
      }
      if (entry && entry.maintenanceMessage) {
        showBlocked({ maintenance: true, message: entry.maintenanceMessage });
        return;
      }
      loadPlayStore();
    })
    .catch(function () {
      loadPlayStore();
    });
})();
