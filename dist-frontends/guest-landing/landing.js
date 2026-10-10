// External file (not inline): the frontends nginx CSP is script-src 'self'.
(function () {
  var API = 'https://api.cullinos.com/api/v1';
  var params = new URLSearchParams(location.search);
  var pathMatch = location.pathname.match(/^\/o\/([^\/]+)\/([^\/]+)/);
  var org = params.get('org') || params.get('orgSlug') || (pathMatch && decodeURIComponent(pathMatch[1])) || '';
  var outlet = params.get('outlet') || params.get('outletSlug') || (pathMatch && decodeURIComponent(pathMatch[2])) || '';
  var table = params.get('table') || '';
  var session = params.get('session') || '';
  var q = new URLSearchParams();
  if (table) q.set('table', table);
  if (session) q.set('session', session);
  var qs = q.toString() ? '?' + q.toString() : '';
  var outletPath = org && outlet
    ? 'outlet/' + encodeURIComponent(org) + '/' + encodeURIComponent(outlet) + qs
    : 'outlet';
  var scheme = 'cullinos://' + outletPath;
  var referrer = encodeURIComponent(
    'utm_source=table_qr&utm_medium=qr&deep_link=' + encodeURIComponent(scheme)
  );
  var intentUrl = 'intent://' + outletPath + '#Intent;scheme=cullinos;package=com.cullinos.guest;end';

  try { localStorage.setItem('cullinos_pending_deep_link', scheme); } catch (e) {}

  var androidBtn = document.getElementById('android');
  var androidTitle = document.getElementById('android-title');
  var iosBtn = document.getElementById('ios');
  var iosTitle = document.getElementById('ios-title');
  var openBtn = document.getElementById('open');
  var statusEl = document.getElementById('status');

  function withReferrer(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'referrer=' + referrer;
  }

  function enableStore(btn, titleEl, href, title) {
    btn.href = href;
    btn.classList.remove('disabled');
    btn.removeAttribute('aria-disabled');
    titleEl.textContent = title;
  }

  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  if (isAndroid) androidBtn.classList.add('recommended');
  if (isIOS) iosBtn.classList.add('recommended');

  openBtn.href = isAndroid ? intentUrl : scheme;

  // Store buttons stay "coming soon" until Super Admin sets a real listing URL.
  fetch(API + '/public/marketplace/app-config')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (body) {
      if (!body) return;
      if (body.playStoreUrl) {
        enableStore(androidBtn, androidTitle, withReferrer(body.playStoreUrl), 'Google Play');
      }
      if (body.appStoreUrl) {
        enableStore(iosBtn, iosTitle, body.appStoreUrl, 'App Store');
      }
    })
    .catch(function () {});

  if (org && outlet) {
    fetch(API + '/storefront/' + encodeURIComponent(org) + '/' + encodeURIComponent(outlet))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (body) {
        if (!body) return;
        var name = body.outletName && body.organizationName && body.outletName !== body.organizationName
          ? body.organizationName + ' · ' + body.outletName
          : (body.outletName || body.organizationName);
        if (!name) return;
        document.getElementById('venue-name').textContent = "You're at " + name + (table ? ' (table ' + table + ')' : '');
        if (body.logoUrl) {
          var img = document.getElementById('venue-logo');
          img.src = body.logoUrl;
          img.hidden = false;
        }
        document.getElementById('venue').style.display = 'flex';
      })
      .catch(function () {});
  }

  // Silent attempt to hand off to an installed app on Android. No store fallback here:
  // if the app is missing the guest stays on this page.
  if (isAndroid && org && outlet) {
    statusEl.textContent = 'Looking for the Cullinos app…';
    window.location.href = intentUrl;
    setTimeout(function () {
      if (!document.hidden) statusEl.textContent = '';
    }, 2000);
  }
})();
