/* =====================================================================
   SAMSON BOUTIQUE — Thème clair / sombre (persisté)
   ===================================================================== */
(function () {
  'use strict';

  const KEY = 'theme';

  function appliquer(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    SB.store.set(KEY, theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.textContent = theme === 'dark' ? '☀️' : '🌙';
      b.setAttribute('aria-label', theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre');
    });
  }

  function courant() {
    return SB.store.get(KEY) ||
      (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function toggle() {
    appliquer(courant() === 'dark' ? 'light' : 'dark');
  }

  function init() {
    appliquer(courant());
    document.querySelectorAll('[data-theme-toggle]').forEach(b =>
      b.addEventListener('click', toggle));
  }

  SB.theme = { appliquer, toggle, init, courant };
})();

/* Application immédiate pour éviter le flash (avant DOMContentLoaded) */
(function () {
  try {
    const t = JSON.parse(localStorage.getItem('sb_theme'));
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
