/**
 * CONTEO — Routeur SPA basé sur l'History API.
 * Aucune dépendance. Support des paramètres :name.
 */

const routes = [];
let notFound = () => {};

/** Enregistre une route. Le handler reçoit un objet params. */
export function route(pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$'
  );
  routes.push({ regex, keys, handler });
}

export function setNotFound(handler) {
  notFound = handler;
}

/** Navigue vers un chemin (pushState). */
export function navigate(path, replace = false) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  resolve();
}

function resolve() {
  const path = location.pathname;
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      r.handler(params);
      window.scrollTo(0, 0);
      return;
    }
  }
  notFound();
}

export function startRouter() {
  window.addEventListener('popstate', resolve);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (a) {
      e.preventDefault();
      navigate(a.getAttribute('href'));
    }
  });
  resolve();
}
