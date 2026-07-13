/* input.js — Entrée unifiée via Pointer Events (jamais souris/tactile séparés).
   Fournit makeDraggable() réutilisé par Formes, Marché et Puzzle. */

/* Tap fiable : feedback < 100 ms, pas de double-tap. */
export function onTap(el, handler) {
  let downId = null, sx = 0, sy = 0, moved = false;
  el.addEventListener("pointerdown", (e) => {
    downId = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== downId) return;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 14) moved = true;
  });
  el.addEventListener("pointerup", (e) => {
    if (e.pointerId !== downId) return;
    downId = null;
    if (!moved) handler(e);
  });
  el.addEventListener("pointercancel", () => { downId = null; });
  el.style.touchAction = "manipulation";
  return el;
}

/* Rend un élément déplaçable avec aimantation vers des cibles.
   opts : { targets:[{el, id}], snapRadius, onDrop(target|null), onHover(target|null), container } */
export function makeDraggable(el, opts = {}) {
  const {
    targets = [], snapRadius = 45, onDrop = () => {}, onHover = () => {},
    container = document.body, returnHome = true
  } = opts;

  el.classList.add("draggable");
  el.style.touchAction = "none";

  let dragging = false, pid = null, startX = 0, startY = 0, baseX = 0, baseY = 0;
  let homeX = 0, homeY = 0, lastHot = null;

  const rectCenter = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  function nearest(px, py) {
    let best = null, bestD = Infinity;
    for (const t of targets) {
      const c = rectCenter(t.el.getBoundingClientRect());
      const d = Math.hypot(px - c.x, py - c.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    return bestD <= snapRadius ? best : null;
  }

  function down(e) {
    dragging = true; pid = e.pointerId;
    el.setPointerCapture(pid);
    el.classList.add("dragging");
    const t = getTranslate(el);
    baseX = t.x; baseY = t.y;
    homeX = t.x; homeY = t.y;
    startX = e.clientX; startY = e.clientY;
  }
  function move(e) {
    if (!dragging || e.pointerId !== pid) return;
    const nx = baseX + (e.clientX - startX);
    const ny = baseY + (e.clientY - startY);
    setTranslate(el, nx, ny);
    const hot = nearest(e.clientX, e.clientY);
    if (hot !== lastHot) {
      if (lastHot) lastHot.el.classList.remove("hot");
      if (hot) hot.el.classList.add("hot");
      lastHot = hot; onHover(hot);
    }
  }
  function up(e) {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false;
    el.classList.remove("dragging");
    try { el.releasePointerCapture(pid); } catch (_) {}
    if (lastHot) lastHot.el.classList.remove("hot");
    const hot = nearest(e.clientX, e.clientY);
    const accepted = onDrop(hot, { el });
    if (!accepted && returnHome) {
      // Retour doux à la place — jamais d'erreur signalée.
      el.style.transition = "transform .22s cubic-bezier(.2,.9,.3,1.2)";
      setTranslate(el, homeX, homeY);
      setTimeout(() => (el.style.transition = ""), 240);
    }
    lastHot = null;
  }

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);

  return {
    destroy() {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    }
  };
}

export function getTranslate(el) {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { x: m.m41, y: m.m42 };
}
export function setTranslate(el, x, y) {
  el.style.transform = `translate(${x}px, ${y}px)`;
}

export default { onTap, makeDraggable, getTranslate, setTranslate };
