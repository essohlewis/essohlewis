/* =========================================================================
   expenses.js — Journal de caisse / dépenses de la boutique (trésorerie).
   Sert à calculer le bénéfice net (encaissements − coûts − dépenses).
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const K = DB.KEYS.expenses;

  const CATEGORIES = ["Approvisionnement", "Transport", "Marketing", "Loyer", "Salaires", "Divers"];

  function byStore(storeId) {
    return DB.all(K).filter((e) => e.storeId === storeId).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Ajoute une dépense pour la boutique du vendeur courant. */
  function add(data) {
    const store = window.MP.Store.byOwner(window.MP.Auth.current() && window.MP.Auth.current().id);
    if (!store) return { ok: false, error: "Boutique introuvable." };
    const amount = Math.round(Number(data.amount) || 0);
    if (!(amount > 0)) return { ok: false, error: "Montant invalide." };
    const exp = {
      id: DB.uid("exp"),
      storeId: store.id,
      label: String(data.label || "Dépense").trim(),
      amount,
      category: CATEGORIES.includes(data.category) ? data.category : "Divers",
      createdAt: data.at ? Number(data.at) : Date.now(),
    };
    return DB.insert(K, exp) ? { ok: true, expense: exp } : { ok: false, error: "Enregistrement impossible." };
  }

  function remove(id) { DB.removeItem(K, id); }

  /** Total des dépenses (optionnellement depuis un timestamp). */
  function total(storeId, sinceTs) {
    return byStore(storeId).filter((e) => !sinceTs || e.createdAt >= sinceTs).reduce((s, e) => s + e.amount, 0);
  }

  window.MP.Expenses = { CATEGORIES, byStore, add, remove, total };
})();
