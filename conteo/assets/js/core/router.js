/* Conteo — Routeur SPA écrit à la main (History API).
 * Routes déclarées avec paramètres :slug. Rendu asynchrone dans #app. */

import { store } from './store.js';

const routes = [];
let notFound = null;
let currentCleanup = null;

/* add('/reader/:slug', renderFn) */
export function add(pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern
    .replace(/\/+$/, '')
    .replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; })
    + '/?$');
  routes.push({ rx, keys, handler, pattern });
}

export function setNotFound(fn) { notFound = fn; }

function match(path) {
  for (const r of routes) {
    const m = r.rx.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
  }
  return null;
}

/* Base STABLE = dossier de index.html, capturé une fois via <base>/document.baseURI.
   Reste constante même sous une route profonde (/reader/<slug>), contrairement à
   location.pathname qui change. Marche sous /, /conteo/, /essohlewis/conteo/, etc. */
const BASE = new URL('./', document.baseURI).pathname;   // ex. '/' ou '/conteo/'

function toAppPath(pathname) {
  return pathname.startsWith(BASE) ? '/' + pathname.slice(BASE.length) : pathname;
}

export async function navigate(path, { replace = false } = {}) {
  const full = BASE.replace(/\/$/, '') + path;
  history[replace ? 'replaceState' : 'pushState']({}, '', full);
  await render(path);
}

async function render(path) {
  const [p, query] = path.split('?');
  const found = match(p) || (notFound && { handler: notFound, params: {} });
  if (!found) return;

  if (typeof currentCleanup === 'function') { try { currentCleanup(); } catch {} }
  currentCleanup = null;

  store.route = { path: p, params: found.params, query: new URLSearchParams(query || '') };
  window.dispatchEvent(new CustomEvent('conteo:route', { detail: { path: p } }));
  try {
    const result = await found.handler(found.params, store.route.query);
    // Une vue peut renvoyer une fonction de nettoyage (arrêt d'audio, rAF, etc.)
    if (typeof result === 'function') currentCleanup = result;
  } catch (err) {
    // Barrière d'erreur : une vue qui échoue ne laisse jamais un écran blanc.
    console.error('Erreur de vue :', err);
    renderErrorScreen(p);
  }
}

function renderErrorScreen(failedPath) {
  const app = document.getElementById('app');
  while (app.firstChild) app.removeChild(app.firstChild);
  const wrap = document.createElement('section');
  wrap.className = 'kid center';
  wrap.style.cssText = 'flex:1;gap:16px;padding:32px';
  const h = document.createElement('h1');
  h.className = 'section-title'; h.textContent = 'Oups, petit souci';
  const p = document.createElement('p');
  p.className = 'text-muted'; p.style.maxWidth = '22rem';
  p.textContent = 'Cette page n’a pas pu s’afficher. Réessaie, ou reviens à l’accueil.';
  const retry = document.createElement('button');
  retry.className = 'btn'; retry.textContent = '↻ Réessayer';
  retry.addEventListener('pointerup', () => render(failedPath));
  const home = document.createElement('button');
  home.className = 'btn btn--ghost'; home.textContent = '🏠 Accueil';
  home.addEventListener('pointerup', () => navigate('/'));
  const row = document.createElement('div');
  row.className = 'row'; row.append(retry, home);
  wrap.append(document.createTextNode('😅'), h, p, row);
  app.append(wrap);
}

export function start() {
  window.addEventListener('popstate', () => render(toAppPath(location.pathname)));
  // Interception des liens internes marqués data-link
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (a && a.getAttribute('href')?.startsWith('/')) {
      e.preventDefault();
      navigate(a.getAttribute('href'));
    }
  });
  render(toAppPath(location.pathname) || '/');
}
