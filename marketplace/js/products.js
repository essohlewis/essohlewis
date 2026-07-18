/* =========================================================================
   products.js — CRUD des articles, vues, avis produit, recherche/filtres.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const K = DB.KEYS.products;

  function all() { return DB.all(K); }
  function get(id) { return DB.find(K, id); }

  /** Articles publiés d'une boutique. */
  function byStore(storeId, includeUnpublished) {
    return DB.all(K).filter(
      (p) => p.storeId === storeId && (includeUnpublished || p.status === "published")
    );
  }

  /** Tous les articles publiés (fil d'accueil). */
  function published() {
    return DB.all(K).filter((p) => p.status === "published");
  }

  /**
   * Crée un article. Notifie les abonnés si publié.
   * @returns { ok, error?, product? }
   */
  function create(data) {
    const user = window.MP.Auth.current();
    const store = window.MP.Store.byOwner(user && user.id);
    if (!store) return { ok: false, error: "Ouvrez d'abord votre boutique." };
    if (!data.title || !data.title.trim()) return { ok: false, error: "Le titre est requis." };
    if (!(Number(data.price) > 0)) return { ok: false, error: "Prix invalide." };

    const product = _normalize(data, {
      id: DB.uid("prd"),
      storeId: store.id,
      views: 0,
      createdAt: Date.now(),
    });
    if (!DB.insert(K, product)) return { ok: false, error: "Espace de stockage plein : réduisez le nombre ou la taille des images." };

    if (product.status === "published") {
      window.MP.Notifications.notifySubscribers(store.id, {
        type: "new_product",
        message: `${store.name} a publié un nouvel article : « ${product.title} »`,
        link: "#/product/" + product.id,
      });
      if (window.MP.SavedSearches) window.MP.SavedSearches.notifyMatches(product);
    }
    return { ok: true, product };
  }

  function update(id, data) {
    const existing = get(id);
    if (!existing) return { ok: false, error: "Article introuvable." };
    const wasPublished = existing.status === "published";
    const wasPromo = promoActive(existing);
    const product = _normalize(data, {
      id: existing.id,
      storeId: existing.storeId,
      views: existing.views,
      createdAt: existing.createdAt,
      cartAdds: existing.cartAdds || 0, // préserve le compteur de conversion
      history: existing.history || [],
      priceLog: existing.priceLog || [], // suivi numérique du prix effectif (sparkline)
    });

    // Historique des modifications (prix, stock, statut, promo).
    const changes = [];
    if (existing.price !== product.price) changes.push(`Prix : ${existing.price} → ${product.price} FCFA`);
    if (existing.stock !== product.stock) changes.push(`Stock : ${existing.stock} → ${product.stock}`);
    if (existing.status !== product.status) changes.push(`Statut : ${existing.status} → ${product.status}`);
    if ((existing.promoPrice || 0) !== (product.promoPrice || 0)) changes.push(`Promo : ${existing.promoPrice || 0} → ${product.promoPrice || 0} FCFA`);
    if (changes.length) product.history = (product.history || []).concat([{ at: Date.now(), changes }]).slice(-30);

    // Journal numérique du prix effectif (pour l'historique de prix côté client).
    const oldEff = effectivePrice(existing), newEff = effectivePrice(product);
    if (oldEff !== newEff) {
      if (!product.priceLog.length) product.priceLog.push({ at: existing.createdAt || Date.now(), price: oldEff });
      product.priceLog = product.priceLog.concat([{ at: Date.now(), price: newEff }]).slice(-30);
    }

    if (!DB.update(K, id, product)) return { ok: false, error: "Espace de stockage plein : réduisez le nombre ou la taille des images." };

    // Alerte baisse de prix aux clients ayant mis l'article en favori.
    const priceDropped = effectivePrice(product) < effectivePrice(existing);
    if (!wasPromo && promoActive(product)) _notifyFavoritersPromo(product);
    // Alertes prix/réassort personnalisées des clients.
    if (window.MP.Alerts) window.MP.Alerts.trigger(get(id), { restocked: existing.stock <= 0 && product.stock > 0, priceDropped });

    // Notifie les abonnés si l'article passe de non-publié à publié.
    if (!wasPublished && product.status === "published") {
      const store = window.MP.Store.get(existing.storeId);
      window.MP.Notifications.notifySubscribers(existing.storeId, {
        type: "new_product",
        message: `${store.name} a publié un nouvel article : « ${product.title} »`,
        link: "#/product/" + id,
      });
    }
    return { ok: true, product: get(id) };
  }

  /** Normalise/nettoie les champs d'un article. */
  function _normalize(data, base) {
    return Object.assign({}, base, {
      title: String(data.title || "").trim(),
      description: String(data.description || "").trim(),
      price: Math.round(Number(data.price) || 0),
      cost: Math.max(0, Math.round(Number(data.cost) || 0)), // coût d'achat (pour la marge)
      promoPrice: data.promoPrice ? Math.round(Number(data.promoPrice)) : 0,
      stock: Math.max(0, Math.round(Number(data.stock) || 0)),
      category: data.category || "mode",
      images: Array.isArray(data.images) && data.images.length ? data.images : [],
      condition: data.condition === "occasion" ? "occasion" : "neuf",
      variants: {
        sizes: (data.variants && data.variants.sizes) || [],
        colors: (data.variants && data.variants.colors) || [],
      },
      status: ["published", "draft", "unpublished"].includes(data.status) ? data.status : "draft",
      featured: !!data.featured,                       // article « à la une »
      negotiable: !!data.negotiable,                   // le client peut proposer un prix
      promoUntil: data.promoUntil ? Number(data.promoUntil) : 0, // fin de promo (timestamp, 0 = illimitée)
      restockDate: data.restockDate ? Number(data.restockDate) : 0, // date de réappro prévue (rupture)
      cartAdds: base.cartAdds || 0,                    // compteur d'ajouts au panier (conversion)
    });
  }

  function remove(id) { DB.removeItem(K, id); }

  /** Incrémente le compteur de vues (fiche produit). */
  function addView(id) {
    const p = get(id);
    if (p) DB.update(K, id, { views: (p.views || 0) + 1 });
  }

  /** Décrémente le stock après commande. */
  function decrementStock(id, qty) {
    const p = get(id);
    if (p) DB.update(K, id, { stock: Math.max(0, (p.stock || 0) - qty) });
  }

  /** Incrémente le compteur d'ajouts au panier (taux de conversion). */
  function addCartCount(id) {
    const p = get(id);
    if (p) DB.update(K, id, { cartAdds: (p.cartAdds || 0) + 1 });
  }

  /** Indique si une promo est active (prix promo valide + non expirée). */
  function promoActive(p) {
    if (!(p.promoPrice && p.promoPrice > 0 && p.promoPrice < p.price)) return false;
    if (p.promoUntil && p.promoUntil > 0 && p.promoUntil < Date.now()) return false;
    return true;
  }

  /** Prix effectif (promo active si présente et non expirée). */
  function effectivePrice(p) {
    return promoActive(p) ? p.promoPrice : p.price;
  }

  /** Mise à jour rapide d'un seul champ (stock, featured…) sans re-notifier. */
  function quickSet(id, patch) {
    const before = get(id);
    const res = DB.update(K, id, patch);
    // Réassort : notifie les alertes si le stock repasse au-dessus de 0.
    if (res && window.MP.Alerts && before && before.stock <= 0 && res.stock > 0) {
      window.MP.Alerts.trigger(res, { restocked: true });
    }
    return res;
  }

  /** Notifie les clients ayant mis l'article en favori d'une baisse de prix. */
  function _notifyFavoritersPromo(p) {
    const favs = DB.get(DB.KEYS.favorites, {});
    const store = window.MP.Store.get(p.storeId);
    Object.keys(favs).forEach((userId) => {
      if ((favs[userId] || []).includes(p.id)) {
        window.MP.Notifications.push(userId, {
          type: "new_product",
          message: `💸 Baisse de prix sur « ${p.title} »${store ? " (" + store.name + ")" : ""} : ${window.MP.UI.fcfa(effectivePrice(p))} !`,
          link: "#/product/" + p.id,
        });
      }
    });
  }

  /** Marge unitaire d'un article (prix effectif − coût d'achat). */
  function margin(p) { return Math.max(0, effectivePrice(p) - (p.cost || 0)); }

  /* ---------- Avis produit ---------- */

  function reviews(productId) {
    return DB.all(DB.KEYS.reviews)
      .filter((r) => r.targetType === "product" && r.targetId === productId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function rating(productId) {
    const rs = reviews(productId);
    if (!rs.length) return { avg: 0, count: 0 };
    return { avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length, count: rs.length };
  }

  /**
   * Ajoute un avis (produit ou boutique).
   * @param {object} { targetType, targetId, rating, comment }
   */
  function addReview({ targetType, targetId, rating, comment, photo }) {
    const user = window.MP.Auth.current();
    if (!user) return { ok: false, error: "Connexion requise." };
    if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Note requise." };
    // Achat vérifié : l'utilisateur a commandé cet article (ou dans cette boutique).
    const orders = window.MP.Orders.byBuyer(user.id);
    const verified = targetType === "product"
      ? orders.some((o) => o.items.some((it) => it.productId === targetId))
      : orders.some((o) => o.storeId === targetId);
    const review = {
      id: DB.uid("rev"),
      targetType,
      targetId,
      userId: user.id,
      userName: user.name,
      rating: Math.round(rating),
      comment: String(comment || "").trim(),
      photo: photo || "",
      verified,
      helpfulBy: [],
      reply: null,
      createdAt: Date.now(),
    };
    DB.insert(DB.KEYS.reviews, review);
    return { ok: true, review };
  }

  /** Vote « utile » sur un avis (bascule). */
  function voteHelpful(reviewId) {
    const user = window.MP.Auth.current();
    if (!user) return { ok: false, error: "Connexion requise." };
    const rev = DB.find(DB.KEYS.reviews, reviewId);
    if (!rev) return { ok: false };
    const by = rev.helpfulBy || [];
    const i = by.indexOf(user.id);
    if (i === -1) by.push(user.id); else by.splice(i, 1);
    DB.update(DB.KEYS.reviews, reviewId, { helpfulBy: by });
    return { ok: true, count: by.length };
  }

  /** Réponse du vendeur à un avis -> notifie l'auteur de l'avis. */
  function replyReview(reviewId, text) {
    const rev = DB.find(DB.KEYS.reviews, reviewId);
    if (!rev) return { ok: false };
    DB.update(DB.KEYS.reviews, reviewId, { reply: { text: String(text).trim(), at: Date.now() } });
    window.MP.Notifications.push(rev.userId, {
      type: "review_reply",
      message: `Le vendeur a répondu à votre avis.`,
      link: rev.targetType === "product" ? "#/product/" + rev.targetId : "#/store/" + rev.targetId,
    });
    return { ok: true };
  }

  /* ---------- Recherche & filtres ---------- */

  /**
   * Filtre les articles publiés.
   * @param {object} f { q, category, commune, storeId, minPrice, maxPrice, sort }
   */
  function search(f) {
    f = f || {};
    let list = published();
    const stores = window.MP.Store.all();
    const storeMap = {};
    stores.forEach((s) => (storeMap[s.id] = s));

    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((p) => {
        const store = storeMap[p.storeId];
        return (
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (store && store.name.toLowerCase().includes(q)) ||
          window.MP.UI.categoryLabel(p.category).toLowerCase().includes(q)
        );
      });
    }
    if (f.category) list = list.filter((p) => p.category === f.category);
    if (f.storeId) list = list.filter((p) => p.storeId === f.storeId);
    if (f.commune) list = list.filter((p) => { const s = storeMap[p.storeId]; return s && s.commune === f.commune; });
    if (f.minPrice != null && f.minPrice !== "") list = list.filter((p) => effectivePrice(p) >= Number(f.minPrice));
    if (f.maxPrice != null && f.maxPrice !== "") list = list.filter((p) => effectivePrice(p) <= Number(f.maxPrice));
    // Filtres avancés.
    if (f.promoOnly) list = list.filter((p) => promoActive(p));
    if (f.inStock) list = list.filter((p) => p.stock > 0);
    if (f.condition) list = list.filter((p) => p.condition === f.condition);
    if (f.freeShip) list = list.filter((p) => { const s = storeMap[p.storeId]; return s && ((s.defaultFee || 0) === 0 || (s.freeShipThreshold && effectivePrice(p) >= s.freeShipThreshold)); });
    if (f.minRating) list = list.filter((p) => rating(p.id).avg >= Number(f.minRating));

    switch (f.sort) {
      case "price_asc": list.sort((a, b) => effectivePrice(a) - effectivePrice(b)); break;
      case "price_desc": list.sort((a, b) => effectivePrice(b) - effectivePrice(a)); break;
      case "popular": list.sort((a, b) => (b.views || 0) - (a.views || 0)); break;
      case "rating": list.sort((a, b) => rating(b.id).avg - rating(a.id).avg); break;
      case "discount": list.sort((a, b) => (promoActive(b) ? 1 - effectivePrice(b) / b.price : 0) - (promoActive(a) ? 1 - effectivePrice(a) / a.price : 0)); break;
      default: list.sort((a, b) => b.createdAt - a.createdAt); // récents
    }
    return list;
  }

  /** Points d'historique de prix (incluant le prix effectif actuel). */
  function priceHistory(product) {
    const log = (product.priceLog || []).slice();
    const cur = effectivePrice(product);
    if (!log.length || log[log.length - 1].price !== cur) log.push({ at: Date.now(), price: cur });
    return log;
  }

  /** Articles fréquemment achetés avec celui-ci (co-occurrence dans les commandes). */
  function boughtTogether(productId, limit) {
    const counts = {};
    window.MP.DB.all(window.MP.DB.KEYS.orders).forEach((o) => {
      const ids = (o.items || []).map((it) => it.productId);
      if (!ids.includes(productId)) return;
      ids.forEach((id) => { if (id !== productId) counts[id] = (counts[id] || 0) + 1; });
    });
    let ids = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    let list = ids.map((id) => get(id)).filter((p) => p && p.status === "published");
    // Complète avec des articles de la même boutique si peu de co-occurrences.
    if (list.length < (limit || 3)) {
      const p = get(productId);
      if (p) {
        const extra = byStore(p.storeId).filter((x) => x.id !== productId && !list.find((l) => l.id === x.id));
        list = list.concat(extra);
      }
    }
    return list.slice(0, limit || 3);
  }

  window.MP.Products = {
    all, get, byStore, published, create, update, remove,
    addView, decrementStock, addCartCount, effectivePrice, promoActive, quickSet, margin,
    reviews, rating, addReview, voteHelpful, replyReview, search, priceHistory, boughtTogether,
  };
})();
