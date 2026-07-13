/* a11y.js — Focus, tailles de cibles, réduction de mouvement. */

export const reducedMotion =
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Applique un palier : ajuste la taille minimale des cibles tactiles. */
export function applyTapSize(palier) {
  const map = { petit: "100px", moyen: "80px", grand: "64px" };
  document.documentElement.style.setProperty("--tap", map[palier] || "64px");
}

/* Déplace le focus vers le premier élément interactif d'une scène (clavier/lecteur d'écran). */
export function focusFirst(scene) {
  const el = scene.querySelector("button, [tabindex], .card, .alpha-cell");
  if (el) el.setAttribute("tabindex", el.getAttribute("tabindex") || "0");
}

/* Annonce un message aux technologies d'assistance. */
let live;
export function announce(msg) {
  if (!live) {
    live = document.createElement("div");
    live.setAttribute("aria-live", "assertive");
    live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
    document.body.appendChild(live);
  }
  live.textContent = "";
  requestAnimationFrame(() => (live.textContent = msg));
}

export default { reducedMotion, applyTapSize, focusFirst, announce };
