/* =========================================================================
   seed.js — Données de démonstration : comptes de test, boutiques, articles,
   abonnements et avis. Injectées une seule fois (drapeau "seeded").
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const UI = window.MP.UI;

  /** Injecte les données de démo si la base est vierge. */
  function run(force) {
    if (!force && DB.get(DB.KEYS.seeded, false)) return;
    if (force) DB.reset();

    const now = Date.now();
    const day = 86400000;

    // ---- Comptes de test ----
    const users = [
      { id: "usr_admin", name: "Admin Marché", email: "admin@test.ci", phone: "0700000000", password: "1234", role: "admin", createdAt: now - 40 * day, commune: "Plateau", address: "" },
      { id: "usr_client", name: "Awa Koné", email: "client@test.ci", phone: "0701020304", password: "1234", role: "client", createdAt: now - 20 * day, commune: "Cocody", address: "Riviera 2, près de la pharmacie" },
      { id: "usr_v1", name: "Mariam Diarra", email: "elegance@test.ci", phone: "0702030405", password: "1234", role: "vendor", createdAt: now - 30 * day, commune: "Cocody", address: "" },
      { id: "usr_v2", name: "Kouassi Yao", email: "hightech@test.ci", phone: "0703040506", password: "1234", role: "vendor", createdAt: now - 28 * day, commune: "Marcory", address: "" },
      { id: "usr_v3", name: "Fatou Bamba", email: "saveurs@test.ci", phone: "0704050607", password: "1234", role: "vendor", createdAt: now - 25 * day, commune: "Yopougon", address: "" },
      { id: "usr_v4", name: "Jean Brou", email: "maison@test.ci", phone: "0705060708", password: "1234", role: "vendor", createdAt: now - 22 * day, commune: "Treichville", address: "" },
    ];
    DB.set(DB.KEYS.users, users);

    // ---- Boutiques & articles : issus du RÉFÉRENTIEL UNIQUE (shared/catalogue.js) ----
    // Le même fichier alimente le serveur (base SQLite) : un seul catalogue,
    // aucune divergence front/back. Ici on l'« hydrate » pour le front (images
    // placeholder, dates absolues, valeurs par défaut de présentation).
    const CAT = window.MP.Catalogue || { STORES: [], PRODUCTS: [] };

    const stores = CAT.STORES.map((s) => {
      const store = Object.assign({}, s, {
        logo: UI.placeholder(s.logoSeed || s.name),
        gallery: (s.gallerySeeds || []).map((g) => UI.placeholder(g)),
        revenueSim: 0,
        createdAt: now - (s.daysAgo || 0) * day,
      });
      if (s.bannerSeed) store.banner = UI.placeholder(s.bannerSeed);
      // Retire les graines de rendu (spécifiques au front), inutiles en base.
      delete store.logoSeed; delete store.bannerSeed; delete store.gallerySeeds; delete store.daysAgo;
      return store;
    });
    DB.set(DB.KEYS.stores, stores);

    const P = (o) => {
      const base = Object.assign({
        views: Math.floor(Math.random() * 300),
        condition: "neuf", status: "published",
        variants: { sizes: [], colors: [] }, promoPrice: 0,
        createdAt: now - Math.floor(Math.random() * 18) * day,
      }, o, { images: (o.imgSeeds || []).map((s) => UI.placeholder(s)) });
      // promoUntilDays (référentiel) → promoUntil (horodatage absolu du front).
      if (o.promoUntilDays) base.promoUntil = now + o.promoUntilDays * day;
      delete base.promoUntilDays;
      return base;
    };
    const products = CAT.PRODUCTS.map((p) => P(Object.assign({}, p)));
    DB.set(DB.KEYS.products, products);

    // ---- Abonnements de démo (la cliente suit 2 boutiques) ----
    DB.set(DB.KEYS.subscriptions, { usr_client: ["sto_1", "sto_2"] });

    // ---- Avis de démo ----
    const reviews = [
      { id: "rev_1", targetType: "product", targetId: "prd_1", userId: "usr_client", userName: "Awa Koné", rating: 5, comment: "Superbe robe, tissu de qualité et livraison rapide !", reply: { text: "Merci beaucoup Awa 🙏 à bientôt !", at: now - 2 * day }, createdAt: now - 3 * day },
      { id: "rev_2", targetType: "product", targetId: "prd_5", userId: "usr_client", userName: "Awa Koné", rating: 4, comment: "Bon téléphone pour le prix. Emballage soigné.", reply: null, createdAt: now - 5 * day },
      { id: "rev_3", targetType: "store", targetId: "sto_1", userId: "usr_client", userName: "Awa Koné", rating: 5, comment: "Boutique sérieuse, je recommande.", reply: null, createdAt: now - 4 * day },
      { id: "rev_4", targetType: "product", targetId: "prd_10", userId: "usr_admin", userName: "Admin Marché", rating: 5, comment: "Attiéké vraiment frais, un régal.", reply: null, createdAt: now - 1 * day },
    ];
    DB.set(DB.KEYS.reviews, reviews);

    // ---- Codes promo de démo ----
    DB.set(DB.KEYS.coupons, [
      { id: "cpn_1", storeId: "sto_1", code: "BIENVENUE10", type: "percent", value: 10, minTotal: 0, maxUses: 0, uses: 0, until: 0, active: true, createdAt: now - 6 * day },
      { id: "cpn_2", storeId: "sto_1", code: "LIVRAISON", type: "freeship", value: 0, minTotal: 15000, maxUses: 50, uses: 3, until: 0, active: true, createdAt: now - 4 * day },
      { id: "cpn_3", storeId: "sto_2", code: "TECH5000", type: "amount", value: 5000, minTotal: 100000, maxUses: 0, uses: 0, until: 0, active: true, createdAt: now - 3 * day },
    ]);

    // ---- Dépenses de démo (journal de caisse boutique 1) ----
    DB.set(DB.KEYS.expenses, [
      { id: "exp_1", storeId: "sto_1", label: "Achat de tissu wax", amount: 45000, category: "Approvisionnement", createdAt: now - 6 * day },
      { id: "exp_2", storeId: "sto_1", label: "Transport marché", amount: 5000, category: "Transport", createdAt: now - 2 * day },
    ]);

    // ---- Message de démo (client -> boutique 1) ----
    DB.set(DB.KEYS.messages, [
      { id: "msg_1", storeId: "sto_1", buyerId: "usr_client", buyerName: "Awa Koné", from: "buyer", text: "Bonjour, la robe pagne est-elle disponible en taille M ?", productId: "prd_1", read: false, createdAt: now - 5 * 3600000 },
    ]);

    // ---- Notification de bienvenue pour la cliente ----
    DB.set(DB.KEYS.notifications, [
      { id: "ntf_seed1", userId: "usr_client", type: "info", message: "Bienvenue sur Marché CI ! Découvrez les boutiques près de chez vous.", link: "#/", read: false, createdAt: now - day },
    ]);

    DB.set(DB.KEYS.seeded, true);
  }

  window.MP.Seed = { run };
})();
