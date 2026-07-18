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

  /* ---------- Fidélité, cagnotte & parrainage ---------- */
  const Loyalty = {
    // 1 point gagné pour 1000 FCFA dépensés (commandes non annulées).
    earned(userId) {
      const spent = window.MP.Orders.byBuyer(userId).filter((o) => o.status !== "annulee").reduce((s, o) => s + o.total, 0);
      return Math.floor(spent / 1000);
    },
    points(userId) { return Loyalty.earned(userId); }, // rétro-compat (points gagnés)
    /** Points disponibles = gagnés − déjà convertis. */
    available(userId) {
      const u = window.MP.DB.find(window.MP.DB.KEYS.users, userId);
      return Math.max(0, Loyalty.earned(userId) - ((u && u.pointsRedeemed) || 0));
    },
    tier(points) {
      if (points >= 200) return { name: "Or", icon: "🥇", min: 200, next: null };
      if (points >= 80) return { name: "Argent", icon: "🥈", min: 80, next: 200 };
      if (points >= 20) return { name: "Bronze", icon: "🥉", min: 20, next: 80 };
      return { name: "Nouveau", icon: "🌱", min: 0, next: 20 };
    },
    /** Convertit des points en coupon global (10 pts = 500 FCFA). */
    redeem(userId, points) {
      points = Math.floor(points / 10) * 10;
      if (points < 10) return { ok: false, error: "Minimum 10 points." };
      if (points > Loyalty.available(userId)) return { ok: false, error: "Points insuffisants." };
      const value = (points / 10) * 500;
      const code = "FID" + Math.random().toString(36).slice(2, 7).toUpperCase();
      const c = window.MP.Coupons.system({ code, type: "amount", value, maxUses: 1 });
      if (!c) return { ok: false, error: "Conversion impossible." };
      const u = window.MP.DB.find(window.MP.DB.KEYS.users, userId);
      window.MP.DB.update(window.MP.DB.KEYS.users, userId, { pointsRedeemed: ((u && u.pointsRedeemed) || 0) + points });
      return { ok: true, code, value };
    },
    referralCode(user) { return "CI" + String(user.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase(); },
    /** Badges/succès débloqués par l'acheteur. */
    badges(userId) {
      const orders = window.MP.Orders.byBuyer(userId).filter((o) => o.status !== "annulee");
      const favs = (window.MP.DB.get(window.MP.DB.KEYS.favorites, {})[userId] || []).length;
      const reviews = window.MP.DB.all(window.MP.DB.KEYS.reviews).filter((r) => r.userId === userId).length;
      const communes = new Set(orders.map((o) => o.storeId)).size;
      return [
        { id: "first", icon: "🎉", name: "Premier achat", unlocked: orders.length >= 1 },
        { id: "loyal", icon: "💛", name: "Client fidèle", unlocked: orders.length >= 5 },
        { id: "explorer", icon: "🧭", name: "Explorateur", unlocked: communes >= 3, hint: "Commander dans 3 boutiques" },
        { id: "critic", icon: "✍️", name: "Bon critique", unlocked: reviews >= 3, hint: "Publier 3 avis" },
        { id: "collector", icon: "❤️", name: "Collectionneur", unlocked: favs >= 5, hint: "5 favoris" },
      ];
    },
  };

  /* ---------- Questions & réponses publiques ---------- */
  const Questions = {
    forProduct(productId) { return window.MP.DB.all(window.MP.DB.KEYS.questions).filter((q) => q.productId === productId).sort((a, b) => b.createdAt - a.createdAt); },
    ask(productId, storeId, text) {
      const user = window.MP.Auth.current();
      if (!user) return { ok: false, error: "Connexion requise." };
      const q = { id: window.MP.DB.uid("qst"), productId, storeId, userId: user.id, userName: user.name, question: String(text || "").trim(), answer: "", answeredAt: 0, createdAt: Date.now() };
      if (!q.question) return { ok: false, error: "Question vide." };
      window.MP.DB.insert(window.MP.DB.KEYS.questions, q);
      const store = window.MP.Store.get(storeId);
      if (store) window.MP.Notifications.push(store.ownerId, { type: "message", message: `Nouvelle question sur « ${window.MP.Products.get(productId).title} ».`, link: "#/product/" + productId });
      return { ok: true };
    },
    answer(questionId, text) {
      const q = window.MP.DB.find(window.MP.DB.KEYS.questions, questionId);
      if (!q) return { ok: false };
      window.MP.DB.update(window.MP.DB.KEYS.questions, questionId, { answer: String(text || "").trim(), answeredAt: Date.now() });
      window.MP.Notifications.push(q.userId, { type: "message", message: `Le vendeur a répondu à votre question.`, link: "#/product/" + q.productId });
      return { ok: true };
    },
    pendingForStore(storeId) { return window.MP.DB.all(window.MP.DB.KEYS.questions).filter((q) => q.storeId === storeId && !q.answer).length; },
  };

  /* ---------- Alertes de recherche ---------- */
  const SavedSearches = {
    forUser(userId) { return window.MP.DB.all(window.MP.DB.KEYS.savedSearches).filter((s) => s.userId === userId).sort((a, b) => b.createdAt - a.createdAt); },
    add(filters, label) {
      const user = window.MP.Auth.current();
      if (!user) return { ok: false, error: "Connexion requise." };
      window.MP.DB.insert(window.MP.DB.KEYS.savedSearches, { id: window.MP.DB.uid("sch"), userId: user.id, label: label || "Recherche", filters: filters || {}, createdAt: Date.now() });
      return { ok: true };
    },
    remove(id) { window.MP.DB.removeItem(window.MP.DB.KEYS.savedSearches, id); },
    /** Notifie les utilisateurs dont une recherche enregistrée correspond au nouvel article. */
    notifyMatches(product) {
      window.MP.DB.all(window.MP.DB.KEYS.savedSearches).forEach((s) => {
        const f = s.filters || {};
        let ok = true;
        if (f.q && !((product.title + " " + product.description).toLowerCase().includes(String(f.q).toLowerCase()))) ok = false;
        if (f.category && product.category !== f.category) ok = false;
        if (f.maxPrice && window.MP.Products.effectivePrice(product) > Number(f.maxPrice)) ok = false;
        if (ok) window.MP.Notifications.push(s.userId, { type: "new_product", message: `🔎 Nouveau résultat pour « ${s.label} » : ${product.title}.`, link: "#/product/" + product.id });
      });
    },
  };

  window.MP.Recent = Recent;
  window.MP.SearchHist = SearchHist;
  window.MP.Alerts = Alerts;
  window.MP.Compare = Compare;
  window.MP.Loyalty = Loyalty;
  window.MP.Questions = Questions;
  window.MP.SavedSearches = SavedSearches;
})();
