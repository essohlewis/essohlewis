/* =========================================================================
   router.js — Routeur SPA minimaliste basé sur le hash (#/...).
   Prend en charge les segments dynamiques (ex : #/product/:id).
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const routes = [];   // { pattern:RegExp, keys:[], handler }
  let notFound = null;
  let beforeEach = null;

  /**
   * Enregistre une route.
   * @param {string} path ex "#/product/:id"
   * @param {function} handler reçoit un objet params
   */
  function on(path, handler) {
    const keys = [];
    // Transforme "#/product/:id" en expression régulière.
    // On échappe d'abord les caractères spéciaux de regex (le « : » n'en fait
    // pas partie et reste intact), puis on remplace les segments « :param ».
    const pattern = new RegExp(
      "^" +
        path
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/:([A-Za-z0-9_]+)/g, (_, k) => {
            keys.push(k);
            return "([^/]+)";
          }) +
        "/?$"
    );
    routes.push({ pattern, keys, handler });
    return this;
  }

  function setNotFound(fn) { notFound = fn; }
  function setBeforeEach(fn) { beforeEach = fn; }

  /** Résout et exécute la route courante. */
  function resolve() {
    let hash = location.hash || "#/";
    if (hash === "#" || hash === "") hash = "#/";
    // Sépare le chemin de l'éventuelle query (#/search?q=x).
    const [path, queryStr] = hash.split("?");
    const query = _parseQuery(queryStr);

    for (const route of routes) {
      const m = route.pattern.exec(path);
      if (m) {
        const params = {};
        route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        params.query = query;
        params.path = path;
        if (beforeEach && beforeEach(path, params) === false) return;
        window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
        route.handler(params);
        _highlightNav(path);
        return;
      }
    }
    if (notFound) notFound();
  }

  function _parseQuery(str) {
    const q = {};
    if (!str) return q;
    str.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
    return q;
  }

  /** Met en évidence l'onglet actif dans la nav basse. */
  function _highlightNav(path) {
    document.querySelectorAll(".bn-item").forEach((el) => {
      const r = el.getAttribute("data-route");
      const active = r === path || (r !== "#/" && path.startsWith(r));
      el.classList.toggle("active", r === "#/" ? path === "#/" : active);
    });
  }

  /** Navigue par programmation. */
  function go(hash) {
    if (location.hash === hash) resolve();
    else location.hash = hash;
  }

  function start() {
    window.addEventListener("hashchange", resolve);
    resolve();
  }

  window.MP.Router = { on, setNotFound, setBeforeEach, resolve, go, start };
})();
