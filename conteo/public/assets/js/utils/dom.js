/**
 * CONTEO — Petites aides DOM (aucune dépendance).
 * Sécurité : on privilégie textContent ; jamais innerHTML avec des données
 * utilisateur non échappées.
 */

/**
 * Crée un élément.
 * @param {string} tag
 * @param {object} [attrs] attributs / propriétés (class, text, html, on*, data-*)
 * @param {(Node|string)[]} [children]
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value; // usage interne uniquement (jamais données user)
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(node) {
  const app = document.getElementById('app');
  clear(app);
  app.append(node);
}

/** Toast éphémère (retour visuel). */
export function toast(message, ms = 2200) {
  const t = el('div', { class: 'toast', text: message });
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
