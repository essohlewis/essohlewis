/* =========================================================================
   db.js — Abstraction localStorage + namespace global MP
   Toutes les données de l'application sont persistées ici (aucun back-end).
   ========================================================================= */

// Namespace global unique de l'application.
window.MP = window.MP || {};

(function () {
  "use strict";

  // Préfixe des clés localStorage pour éviter les collisions.
  const PREFIX = "marchesci_";

  // Clés de stockage utilisées dans toute l'application.
  const KEYS = {
    users: "users",
    stores: "stores",
    products: "products",
    orders: "orders",
    carts: "carts",              // { userId: [ {productId, qty, variant} ] }
    favorites: "favorites",      // { userId: [productId] }
    subscriptions: "subs",       // { userId: [storeId] }
    notifications: "notifs",     // [ {id, userId, ...} ]
    reviews: "reviews",          // [ {id, targetType, targetId, ...} ]
    coupons: "coupons",          // [ {id, storeId, code, type, value, ...} ]
    messages: "messages",        // [ {id, storeId, buyerId, from, text, ...} ]
    expenses: "expenses",        // [ {id, storeId, label, amount, category, createdAt} ]
    session: "session",          // { userId }
    theme: "theme",              // "light" | "dark"
    seeded: "seeded",            // bool
  };

  /**
   * Lit une valeur JSON du localStorage.
   * @param {string} key   clé (sans préfixe)
   * @param {*} fallback    valeur par défaut si absente / invalide
   */
  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("DB.get échec pour", key, e);
      return fallback;
    }
  }

  /**
   * Écrit une valeur JSON dans le localStorage.
   * Gère l'erreur de quota (images base64 volumineuses).
   */
  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("DB.set échec pour", key, e);
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
        if (window.MP.UI) {
          window.MP.UI.toast(
            "Espace de stockage plein : réduisez la taille/le nombre d'images.",
            "error"
          );
        }
      }
      return false;
    }
  }

  function remove(key) {
    localStorage.removeItem(PREFIX + key);
  }

  /** Réinitialise entièrement la base (démo). */
  function reset() {
    Object.values(KEYS).forEach(remove);
  }

  /** Génère un identifiant unique court. */
  function uid(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7)
    );
  }

  // --- Helpers de collections (tableaux d'objets avec { id }) ---

  function all(key) {
    return get(key, []);
  }

  function find(key, id) {
    return all(key).find((x) => x.id === id) || null;
  }

  function insert(key, obj) {
    const list = all(key);
    list.push(obj);
    // Renvoie null si l'écriture échoue (ex : quota localStorage dépassé).
    return set(key, list) ? obj : null;
  }

  function update(key, id, patch) {
    const list = all(key);
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch);
    // Renvoie null si l'écriture échoue (ex : quota localStorage dépassé).
    return set(key, list) ? list[idx] : null;
  }

  function removeItem(key, id) {
    const list = all(key).filter((x) => x.id !== id);
    set(key, list);
  }

  // Exposition publique.
  window.MP.DB = {
    KEYS,
    get,
    set,
    remove,
    reset,
    uid,
    all,
    find,
    insert,
    update,
    removeItem,
  };
})();
