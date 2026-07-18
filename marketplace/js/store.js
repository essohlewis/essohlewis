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
      revenueSim: 0,
      salesGoal: Number(data.salesGoal) || 0, // objectif de vente mensuel (FCFA)
      closed: false,                          // mode fermé / vacances
      closedMsg: "",                          // message affiché quand fermé
      promoBanner: "",                        // bandeau promotionnel de la vitrine
      defaultFee: Number(data.defaultFee) || 0, // frais de livraison par défaut
      deliveryFees: data.deliveryFees || {},  // { commune: frais }
      zones: data.zones || [],                // communes desservies (vide = toutes)
      createdAt: Date.now(),
    };
    DB.insert(K, store);
    // L'utilisateur devient vendeur.
    window.MP.Auth.becomeVendor();
    return { ok: true, store };
  }

  function update(id, patch) {
    const store = get(id);
    const user = window.MP.Auth.current();
    if (!store || !user || (store.ownerId !== user.id && user.role !== "admin")) {
      return { ok: false, error: "Non autorisé." };
    }
    return { ok: true, store: DB.update(K, id, patch) };
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
  };
})();
