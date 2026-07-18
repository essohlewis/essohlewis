/* =========================================================================
   client.js — Fonctionnalités côté acheteur : articles vus récemment,
   historique de recherche, alertes prix/réassort, comparateur, fidélité.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const uid = () => { const u = window.MP.Auth && window.MP.Auth.current(); return u ? u.id : "guest"; };

  /* ---------- Articles vus récemment ---------- */
  const Recent = {
    add(productId) {
      const map = DB.get(DB.KEYS.recent, {});
      const key = uid();
      let list = (map[key] || []).filter((id) => id !== productId);
      list.unshift(productId);
      map[key] = list.slice(0, 20);
      DB.set(DB.KEYS.recent, map);
    },
    list() {
      const map = DB.get(DB.KEYS.recent, {});
      return (map[uid()] || []).map((id) => window.MP.Products.get(id)).filter((p) => p && p.status === "published");
    },
    clear() { const map = DB.get(DB.KEYS.recent, {}); map[uid()] = []; DB.set(DB.KEYS.recent, map); },
  };

  /* ---------- Historique de recherche ---------- */
  const SearchHist = {
    add(term) {
      term = String(term || "").trim();
      if (!term) return;
      const map = DB.get(DB.KEYS.searchHist, {});
      const key = uid();
      let list = (map[key] || []).filter((t) => t.toLowerCase() !== term.toLowerCase());
      list.unshift(term);
      map[key] = list.slice(0, 10);
      DB.set(DB.KEYS.searchHist, map);
    },
    list() { return DB.get(DB.KEYS.searchHist, {})[uid()] || []; },
    clear() { const map = DB.get(DB.KEYS.searchHist, {}); map[uid()] = []; DB.set(DB.KEYS.searchHist, map); },
  };

  /* ---------- Alertes prix / réassort ---------- */
  const Alerts = {
    all() { return DB.all(DB.KEYS.alerts); },
    forUser(userId) { return Alerts.all().filter((a) => a.userId === userId); },
    forProduct(userId, productId) { return Alerts.all().filter((a) => a.userId === userId && a.productId === productId); },
    /** Crée une alerte ("price" avec targetPrice, ou "restock"). */
    add(productId, type, targetPrice) {
      const user = window.MP.Auth.current();
      if (!user) return { ok: false, error: "Connexion requise." };
      // Évite les doublons du même type.
      const existing = Alerts.forProduct(user.id, productId).find((a) => a.type === type);
      if (existing) { DB.update(DB.KEYS.alerts, existing.id, { targetPrice: Number(targetPrice) || 0 }); return { ok: true }; }
      DB.insert(DB.KEYS.alerts, { id: DB.uid("alt"), userId: user.id, productId, type, targetPrice: Number(targetPrice) || 0, createdAt: Date.now() });
      return { ok: true };
    },
    remove(id) { DB.removeItem(DB.KEYS.alerts, id); },
    /**
     * Déclenche les alertes correspondantes pour un article mis à jour.
     * @param {object} product
     * @param {object} ctx { restocked:bool, price:number }
     */
    trigger(product, ctx) {
      ctx = ctx || {};
      const list = Alerts.all().filter((a) => a.productId === product.id);
      const store = window.MP.Store.get(product.storeId);
      const price = window.MP.Products.effectivePrice(product);
      const fired = [];
      list.forEach((a) => {
        if (a.type === "price" && price <= (a.targetPrice || Infinity)) {
          window.MP.Notifications.push(a.userId, { type: "new_product", message: `🔔 « ${product.title} » est à ${window.MP.UI.fcfa(price)} (alerte prix atteinte).`, link: "#/product/" + product.id });
          fired.push(a.id);
        } else if (a.type === "restock" && ctx.restocked && product.stock > 0) {
          window.MP.Notifications.push(a.userId, { type: "new_product", message: `🔔 « ${product.title} »${store ? " (" + store.name + ")" : ""} est de nouveau en stock !`, link: "#/product/" + product.id });
          fired.push(a.id);
        }
      });
      fired.forEach((id) => Alerts.remove(id));
    },
  };

  /* ---------- Comparateur d'articles ---------- */
  const KEY_CMP = "compare_" ;
  const Compare = {
    _key() { return KEY_CMP + uid(); },
    list() { return DB.get(Compare._key(), []); },
    has(id) { return Compare.list().includes(id); },
    toggle(id) {
      let list = Compare.list();
      if (list.includes(id)) { list = list.filter((x) => x !== id); }
      else { if (list.length >= 4) return { ok: false, error: "Comparateur limité à 4 articles." }; list.push(id); }
      DB.set(Compare._key(), list);
      return { ok: true, added: Compare.list().includes(id) };
    },
    clear() { DB.set(Compare._key(), []); },
    count() { return Compare.list().length; },
  };

  /* ---------- Fidélité & parrainage ---------- */
  const Loyalty = {
    // 1 point pour 1000 FCFA dépensés (commandes non annulées).
    points(userId) {
      const spent = window.MP.Orders.byBuyer(userId).filter((o) => o.status !== "annulee").reduce((s, o) => s + o.total, 0);
      return Math.floor(spent / 1000);
    },
    tier(points) {
      if (points >= 200) return { name: "Or", icon: "🥇", min: 200, next: null };
      if (points >= 80) return { name: "Argent", icon: "🥈", min: 80, next: 200 };
      if (points >= 20) return { name: "Bronze", icon: "🥉", min: 20, next: 80 };
      return { name: "Nouveau", icon: "🌱", min: 0, next: 20 };
    },
    referralCode(user) { return "CI" + String(user.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase(); },
  };

  window.MP.Recent = Recent;
  window.MP.SearchHist = SearchHist;
  window.MP.Alerts = Alerts;
  window.MP.Compare = Compare;
  window.MP.Loyalty = Loyalty;
})();
