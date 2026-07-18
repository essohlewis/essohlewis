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
    DB.insert(K, product);

    if (product.status === "published") {
      window.MP.Notifications.notifySubscribers(store.id, {
        type: "new_product",
        message: `${store.name} a publié un nouvel article : « ${product.title} »`,
        link: "#/product/" + product.id,
      });
    }
    return { ok: true, product };
  }

  function update(id, data) {
    const existing = get(id);
    if (!existing) return { ok: false, error: "Article introuvable." };
    const wasPublished = existing.status === "published";
    const product = _normalize(data, {
      id: existing.id,
      storeId: existing.storeId,
      views: existing.views,
      createdAt: existing.createdAt,
    });
    DB.update(K, id, product);

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

  /** Prix effectif (promo si présente). */
  function effectivePrice(p) {
    return p.promoPrice && p.promoPrice > 0 && p.promoPrice < p.price ? p.promoPrice : p.price;
  }

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
  function addReview({ targetType, targetId, rating, comment }) {
    const user = window.MP.Auth.current();
    if (!user) return { ok: false, error: "Connexion requise." };
    if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Note requise." };
    const review = {
      id: DB.uid("rev"),
      targetType,
      targetId,
      userId: user.id,
      userName: user.name,
      rating: Math.round(rating),
      comment: String(comment || "").trim(),
      reply: null,
      createdAt: Date.now(),
    };
    DB.insert(DB.KEYS.reviews, review);
    return { ok: true, review };
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

    switch (f.sort) {
      case "price_asc": list.sort((a, b) => effectivePrice(a) - effectivePrice(b)); break;
      case "price_desc": list.sort((a, b) => effectivePrice(b) - effectivePrice(a)); break;
      case "popular": list.sort((a, b) => (b.views || 0) - (a.views || 0)); break;
      default: list.sort((a, b) => b.createdAt - a.createdAt); // récents
    }
    return list;
  }

  window.MP.Products = {
    all, get, byStore, published, create, update, remove,
    addView, decrementStock, effectivePrice,
    reviews, rating, addReview, replyReview, search,
  };
})();
