/* Conteo — Aides accessibilité. */

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/* Piège de focus simple pour les modales/écrans de verrou. */
export function trapFocus(container) {
  const sel = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

/* Applique une animation Web Animations API en respectant reduced-motion. */
export function animate(node, keyframes, options) {
  if (prefersReducedMotion() || !node.animate) return { finished: Promise.resolve() };
  return node.animate(keyframes, options);
}
