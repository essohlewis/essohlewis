/* =========================================================================
   cart.js — Panier multi-boutiques. Les articles sont regroupés par boutique
   au moment du récapitulatif (une commande par boutique).
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;

  /** Clé du panier pour l'utilisateur courant (ou panier "invité"). */
  function _key() {
    const u = window.MP.Auth.current();
    return u ? u.id : "guest";
  }

  function _all() { return DB.get(DB.KEYS.carts, {}); }
  function _save(map) { DB.set(DB.KEYS.carts, map); if (window.MP.UI) window.MP.UI.refreshBadges(); }

  /** Lignes du panier courant : [ {productId, qty, variant} ]. */
  function items() {
    const map = _all();
    return map[_key()] || [];
  }

  /** Nombre total d'unités dans le panier. */
  function count() {
    return items().reduce((s, i) => s + i.qty, 0);
  }

  /**
   * Ajoute un article au panier (ou incrémente la quantité).
   * @param {string} productId
   * @param {number} qty
   * @param {object} variant { size, color }
   */
  function add(productId, qty, variant) {
    qty = Math.max(1, qty || 1);
    const product = window.MP.Products.get(productId);
    if (!product) return { ok: false, error: "Article introuvable." };
    if (product.stock <= 0) return { ok: false, error: "Article en rupture de stock." };

    const map = _all();
    const key = _key();
    map[key] = map[key] || [];
    const vKey = JSON.stringify(variant || {});
    const line = map[key].find((i) => i.productId === productId && JSON.stringify(i.variant || {}) === vKey);
    if (line) {
      line.qty = Math.min(product.stock, line.qty + qty);
    } else {
      map[key].push({ productId, qty: Math.min(product.stock, qty), variant: variant || {} });
    }
    _save(map);
    return { ok: true };
  }

  function setQty(productId, variant, qty) {
    const map = _all();
    const key = _key();
    const vKey = JSON.stringify(variant || {});
    const line = (map[key] || []).find((i) => i.productId === productId && JSON.stringify(i.variant || {}) === vKey);
    if (!line) return;
    const product = window.MP.Products.get(productId);
    line.qty = Math.max(1, Math.min(product ? product.stock : qty, qty));
    _save(map);
  }

  function removeLine(productId, variant) {
    const map = _all();
    const key = _key();
    const vKey = JSON.stringify(variant || {});
    map[key] = (map[key] || []).filter((i) => !(i.productId === productId && JSON.stringify(i.variant || {}) === vKey));
    _save(map);
  }

  function clear() {
    const map = _all();
    map[_key()] = [];
    _save(map);
  }

  /**
   * Regroupe le panier par boutique, avec détails produit et sous-totaux.
   * @returns [ { store, lines:[{product, qty, variant, subtotal}], subtotal } ]
   */
  function grouped() {
    const groups = {};
    items().forEach((it) => {
      const product = window.MP.Products.get(it.productId);
      if (!product) return; // article supprimé entre-temps
      const store = window.MP.Store.get(product.storeId);
      if (!store) return;
      if (!groups[store.id]) groups[store.id] = { store, lines: [], subtotal: 0 };
      const unit = window.MP.Products.effectivePrice(product);
      const subtotal = unit * it.qty;
      groups[store.id].lines.push({ product, qty: it.qty, variant: it.variant, unit, subtotal });
      groups[store.id].subtotal += subtotal;
    });
    return Object.values(groups);
  }

  /** Total général du panier. */
  function total() {
    return grouped().reduce((s, g) => s + g.subtotal, 0);
  }

  /** Fusionne le panier invité avec celui de l'utilisateur à la connexion. */
  function mergeGuestInto(userId) {
    const map = _all();
    if (!map.guest || !map.guest.length) return;
    map[userId] = map[userId] || [];
    map.guest.forEach((g) => {
      const vKey = JSON.stringify(g.variant || {});
      const existing = map[userId].find((i) => i.productId === g.productId && JSON.stringify(i.variant || {}) === vKey);
      if (existing) existing.qty += g.qty;
      else map[userId].push(g);
    });
    map.guest = [];
    _save(map);
  }

  window.MP.Cart = {
    items, count, add, setQty, removeLine, clear, grouped, total, mergeGuestInto,
  };
})();
