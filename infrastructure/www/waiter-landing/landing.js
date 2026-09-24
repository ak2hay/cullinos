// External file (not inline): the frontends nginx CSP is script-src 'self'.
(function () {
  var btn = document.getElementById('play');
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
})();
