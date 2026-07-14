/* Conteo — Helpers DOM minimalistes.
 * el() construit un élément ; jamais innerHTML avec des données utilisateur. */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;           // sûr : textContent
    else if (k === 'html') node.innerHTML = v;             // uniquement contenu de confiance
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node && k !== 'list') {
      try { node[k] = v; } catch { node.setAttribute(k, v); }
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export function on(target, type, handler, opts) {
  target.addEventListener(type, handler, opts);
  return () => target.removeEventListener(type, handler, opts);
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function mount(node) {
  const app = document.getElementById('app');
  clear(app);
  app.append(node);
  app.scrollTo?.(0, 0);
  return node;
}

/* Toast non bloquant */
export function toast(message, kind = '') {
  const root = document.getElementById('toast-root');
  const t = el('div', { class: `toast ${kind ? 'toast--' + kind : ''}`, role: 'status', text: message });
  root.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

/* Modale simple, renvoie une fonction de fermeture */
export function modal(contentNode, { dismissable = true } = {}) {
  const backdrop = el('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true' });
  const box = el('div', { class: 'modal' }, [contentNode]);
  backdrop.append(box);
  const close = () => backdrop.remove();
  if (dismissable) {
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) close(); });
  }
  document.body.append(backdrop);
  return close;
}
