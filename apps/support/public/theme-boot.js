/* Applies the saved theme before first paint (see @cullinos/ui theme-mode.ts). Super admin defaults to light. */
(function () {
  var theme = 'light';
  try {
    var stored = localStorage.getItem('cullinos-theme');
    if (stored === 'dark') theme = 'dark';
    else if (stored !== 'light') localStorage.setItem('cullinos-theme', 'light');
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
})();
