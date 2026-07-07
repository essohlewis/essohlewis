/* =====================================================================
   theme.js — Bascule clair/sombre + persistance localStorage
   Le thème sombre est le défaut (direction artistique premium).
   ===================================================================== */
(function () {
  const KEY = 'pronos-theme';
  const root = document.documentElement;

  function stored() { return localStorage.getItem(KEY); }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    // Mettre à jour la couleur de la barre d'état mobile (PWA)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F4F6FB' : '#0A0E1A');
    // Refléter l'état sur d'éventuels toggles/switch de la page
    document.querySelectorAll('[data-theme-switch]').forEach((s) => {
      s.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    });
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  // Init : préférence sauvegardée sinon défaut sombre
  apply(stored() || 'dark');

  function toggle() {
    apply(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  // Brancher les boutons/toggles au chargement
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) =>
      btn.addEventListener('click', toggle)
    );
  });

  // API globale (utilisée par la page paramètres du dashboard)
  window.PronosTheme = { toggle, apply, get: () => root.getAttribute('data-theme') };
})();
