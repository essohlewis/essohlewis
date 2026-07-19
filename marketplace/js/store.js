/* =========================================================================
   store.js — Gestion des boutiques (vitrines), abonnements, avis boutique.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const K = DB.KEYS.stores;

  function all() { return DB.all(K); }
  function get(id) { return DB.find(K, id); }

  /** Boutique appartenant à un utilisateur (un vendeur = une boutique ici). */
  function byOwner(ownerId) {
    return DB.all(K).find((s) => s.ownerId === ownerId) || null;
  }

  /**
   * Crée une boutique pour l'utilisateur courant.
   * @returns { ok, error?, store? }
   */
  function create(data) {
    const user = window.MP.Auth.current();
    if (!user) return { ok: false, error: "Connexion requise." };
    if (byOwner(user.id)) return { ok: false, error: "Vous avez déjà une boutique." };
    if (!data.name || !data.name.trim()) return { ok: false, error: "Le nom de la boutique est requis." };

    const store = {
      id: DB.uid("sto"),
      ownerId: user.id,
      name: data.name.trim(),
      logo: data.logo || "",
      banner: data.banner || "",
      description: data.description || "",
      category: data.category || "mode",
      commune: data.commune || "Cocody",
      hours: data.hours || "Lun–Sam : 08h–19h",
      whatsapp: data.whatsapp || "",
      socials: data.socials || {},
      slogan: data.slogan || "",          // accroche courte affichée en vitrine
      themeColor: data.themeColor || "",  // couleur d'accent de la vitrine
      gallery: data.gallery || [],        // galerie photos (base64)
      faq: data.faq || "",                // questions fréquentes (affichées en vitrine)
      returnPolicy: data.returnPolicy || "", // politique de retour
      revenueSim: 0,
      salesGoal: Number(data.salesGoal) || 0, // objectif de vente mensuel (FCFA)
      closed: false,                          // mode fermé / vacances
      closedMsg: "",                          // message affiché quand fermé
      promoBanner: "",                        // bandeau promotionnel de la vitrine
      defaultFee: Number(data.defaultFee) || 0, // frais de livraison par défaut
      freeShipThreshold: Number(data.freeShipThreshold) || 0, // livraison offerte dès X FCFA (0 = jamais)
      deliveryFees: data.deliveryFees || {},  // { commune: frais }
      zones: data.zones || [],                // communes desservies (vide = toutes)
      schedule: data.schedule || null,        // horaires par jour { mon:{open,close,closed}, ... }
      lowStockThreshold: data.lowStockThreshold != null ? Number(data.lowStockThreshold) : 3,
      notifPrefs: data.notifPrefs || { newOrder: true, message: true, lowStock: true, review: true },
      staff: data.staff || [],                // [ {userId, name, email, role} ]
      createdAt: Date.now(),
    };
    if (!DB.insert(K, store)) return { ok: false, error: "Espace de stockage plein : réduisez la taille des images." };
    // L'utilisateur devient vendeur.
    window.MP.Auth.becomeVendor();
    return { ok: true, store };
  }

  function update(id, patch) {
    const store = get(id);
    const user = window.MP.Auth.current();
    const isStaff = store && user && (store.staff || []).some((s) => s.userId === user.id);
    if (!store || !user || (store.ownerId !== user.id && user.role !== "admin" && !isStaff)) {
      return { ok: false, error: "Non autorisé." };
    }
    const updated = DB.update(K, id, patch);
    if (!updated) return { ok: false, error: "Espace de stockage plein : réduisez le nombre ou la taille des images." };
    return { ok: true, store: updated };
  }

  /** Rôle d'un utilisateur pour une boutique : "owner" | "gerant" | "preparateur" | null. */
  function roleFor(store, userId) {
    if (!store) return null;
    if (store.ownerId === userId) return "owner";
    const s = (store.staff || []).find((x) => x.userId === userId);
    return s ? s.role : null;
  }

  /** Boutique gérée par un utilisateur (propriétaire OU membre du staff). */
  function managedBy(userId) {
    return byOwner(userId) || all().find((st) => (st.staff || []).some((s) => s.userId === userId)) || null;
  }

  /** Indique si la boutique est ouverte maintenant selon ses horaires (fallback : ouverte). */
  function isOpenNow(store) {
    if (!store) return true;
    if (store.closed) return false;
    const sch = store.schedule;
    if (!sch) return true;
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const now = new Date();
    const d = sch[days[now.getDay()]];
    if (!d || d.closed) return false;
    if (!d.open || !d.close) return true;
    const cur = now.getHours() * 60 + now.getMinutes();
    const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
    return cur >= toMin(d.open) && cur < toMin(d.close);
  }

  /** Frais de livraison d'une boutique pour une commune donnée. */
  function deliveryFee(store, commune) {
    if (!store) return 0;
    const fees = store.deliveryFees || {};
    if (commune && fees[commune] != null && fees[commune] !== "") return Number(fees[commune]) || 0;
    return Number(store.defaultFee) || 0;
  }

  /** Indique si une boutique dessert une commune (zones vides = toutes). */
  function servesCommune(store, commune) {
    if (!store || !store.zones || !store.zones.length) return true;
    return store.zones.includes(commune);
  }

  function remove(id) {
    DB.removeItem(K, id);
    // Supprime aussi les articles de la boutique.
    DB.all(DB.KEYS.products)
      .filter((p) => p.storeId === id)
      .forEach((p) => DB.removeItem(DB.KEYS.products, p.id));
  }

  /* ---------- Abonnements ---------- */

  function subscribers(storeId) {
    const subs = DB.get(DB.KEYS.subscriptions, {});
    return Object.keys(subs).filter((uid) => (subs[uid] || []).includes(storeId));
  }

  function subscriberCount(storeId) { return subscribers(storeId).length; }

  function isSubscribed(userId, storeId) {
    const subs = DB.get(DB.KEYS.subscriptions, {});
    return (subs[userId] || []).includes(storeId);
  }

  /** Bascule l'abonnement de l'utilisateur courant à une boutique. */
  function toggleSubscribe(storeId) {
    const user = window.MP.Auth.current();
    if (!user) return { ok: false, error: "Connexion requise." };
    const subs = DB.get(DB.KEYS.subscriptions, {});
    subs[user.id] = subs[user.id] || [];
    const idx = subs[user.id].indexOf(storeId);
    let subscribed;
    if (idx === -1) { subs[user.id].push(storeId); subscribed = true; }
    else { subs[user.id].splice(idx, 1); subscribed = false; }
    DB.set(DB.KEYS.subscriptions, subs);
    return { ok: true, subscribed };
  }

  /* ---------- Avis boutique (note moyenne) ---------- */

  function reviews(storeId) {
    return DB.all(DB.KEYS.reviews)
      .filter((r) => r.targetType === "store" && r.targetId === storeId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function rating(storeId) {
    const rs = reviews(storeId);
    if (!rs.length) return { avg: 0, count: 0 };
    const avg = rs.reduce((s, r) => s + r.rating, 0) / rs.length;
    return { avg, count: rs.length };
  }

  window.MP.Store = {
    all, get, byOwner, create, update, remove,
    subscribers, subscriberCount, isSubscribed, toggleSubscribe,
    reviews, rating, deliveryFee, servesCommune,
    roleFor, managedBy, isOpenNow,
  };
})();
