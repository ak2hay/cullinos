/* Applies the saved Light/Dark/System theme before first paint (see @cullinos/ui theme-mode.ts). */
(function () {
  var theme = 'dark';
  try {
    var stored = localStorage.getItem('cullinos-theme');
    if (stored === 'light' || stored === 'dark') theme = stored;
    else if (window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'light';
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
})();
