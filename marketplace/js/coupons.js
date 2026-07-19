/* =========================================================================
   coupons.js — Codes promo / coupons créés par le vendeur, appliqués au
   checkout par l'acheteur.
   Types : "percent" (%), "amount" (FCFA), "freeship" (livraison offerte).
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const K = DB.KEYS.coupons;

  function all() { return DB.all(K); }
  function byStore(storeId) { return all().filter((c) => c.storeId === storeId).sort((a, b) => b.createdAt - a.createdAt); }

  function byCode(storeId, code) {
    const norm = String(code || "").trim().toUpperCase();
    // Coupon de la boutique, sinon coupon global marketplace ("*").
    return all().find((c) => c.storeId === storeId && c.code.toUpperCase() === norm)
      || all().find((c) => c.storeId === "*" && c.code.toUpperCase() === norm)
      || null;
  }

  /** Coupons globaux (marketplace) — administration. */
  function globalCoupons() { return all().filter((c) => c.storeId === "*").sort((a, b) => b.createdAt - a.createdAt); }

  /** Crée un coupon global (admin) valable sur toutes les boutiques. */
  function createGlobal(data) {
    const user = window.MP.Auth.current();
    if (!user || user.role !== "admin") return { ok: false, error: "Réservé à l'administrateur." };
    const code = String(data.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return { ok: false, error: "Code invalide (3–20 lettres/chiffres)." };
    if (byCode("*", code)) return { ok: false, error: "Ce code existe déjà." };
    const type = ["percent", "amount", "freeship"].includes(data.type) ? data.type : "percent";
    if (type === "percent" && !(Number(data.value) > 0 && Number(data.value) <= 90)) return { ok: false, error: "Pourcentage invalide (1–90)." };
    if (type === "amount" && !(Number(data.value) > 0)) return { ok: false, error: "Montant invalide." };
    const coupon = {
      id: DB.uid("cpn"), storeId: "*", code, type,
      value: type === "freeship" ? 0 : Math.round(Number(data.value)),
      minTotal: Math.max(0, Math.round(Number(data.minTotal) || 0)),
      maxUses: Math.max(0, Math.round(Number(data.maxUses) || 0)),
      uses: 0, until: data.until ? Number(data.until) : 0, active: true, global: true, createdAt: Date.now(),
    };
    DB.insert(K, coupon);
    return { ok: true, coupon };
  }

  /** Crée un coupon pour la boutique du vendeur courant. */
  function create(data) {
    const user = window.MP.Auth.current();
    const store = window.MP.Store.byOwner(user && user.id);
    if (!store) return { ok: false, error: "Boutique introuvable." };
    const code = String(data.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return { ok: false, error: "Code invalide (3–20 lettres/chiffres)." };
    if (byCode(store.id, code)) return { ok: false, error: "Ce code existe déjà." };
    const type = ["percent", "amount", "freeship"].includes(data.type) ? data.type : "percent";
    if (type === "percent" && !(Number(data.value) > 0 && Number(data.value) <= 90)) return { ok: false, error: "Pourcentage invalide (1–90)." };
    if (type === "amount" && !(Number(data.value) > 0)) return { ok: false, error: "Montant invalide." };

    const coupon = {
      id: DB.uid("cpn"),
      storeId: store.id,
      code,
      type,
      value: type === "freeship" ? 0 : Math.round(Number(data.value)),
      minTotal: Math.max(0, Math.round(Number(data.minTotal) || 0)),
      maxUses: Math.max(0, Math.round(Number(data.maxUses) || 0)), // 0 = illimité
      uses: 0,
      until: data.until ? Number(data.until) : 0, // 0 = pas d'expiration
      active: true,
      createdAt: Date.now(),
    };
    DB.insert(K, coupon);
    return { ok: true, coupon };
  }

  function update(id, patch) { return DB.update(K, id, patch); }
  function remove(id) { DB.removeItem(K, id); }

  /** Libellé lisible d'un coupon. */
  function label(c) {
    if (c.type === "percent") return "-" + c.value + "%";
    if (c.type === "amount") return "-" + window.MP.UI.fcfa(c.value);
    return "Livraison offerte";
  }

  /**
   * Valide un code pour une boutique et un sous-total donnés.
   * @returns { ok, error?, coupon?, discount?, freeShip? }
   */
  function validate(storeId, code, subtotal) {
    const c = byCode(storeId, code);
    if (!c) return { ok: false, error: "Code promo inconnu." };
    if (!c.active) return { ok: false, error: "Ce code n'est plus actif." };
    if (c.until && c.until < Date.now()) return { ok: false, error: "Ce code a expiré." };
    if (c.maxUses && c.uses >= c.maxUses) return { ok: false, error: "Ce code a atteint sa limite d'utilisation." };
    if (c.minTotal && subtotal < c.minTotal) return { ok: false, error: "Minimum " + window.MP.UI.fcfa(c.minTotal) + " requis." };

    let discount = 0, freeShip = false;
    if (c.type === "percent") discount = Math.round((subtotal * c.value) / 100);
    else if (c.type === "amount") discount = Math.min(subtotal, c.value);
    else freeShip = true;
    return { ok: true, coupon: c, discount, freeShip };
  }

  /** Incrémente le compteur d'utilisation (à la validation d'une commande). */
  function redeem(id) {
    const c = DB.find(K, id);
    if (c) DB.update(K, id, { uses: (c.uses || 0) + 1 });
  }

  window.MP.Coupons = { all, byStore, byCode, create, update, remove, label, validate, redeem, globalCoupons, createGlobal };
})();
