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

    // ---- Boutiques ----
    const stores = [
      {
        id: "sto_1", ownerId: "usr_v1", name: "Élégance Abidjan",
        logo: UI.placeholder("Élégance"), banner: UI.placeholder("Mode"),
        description: "Boutique de mode féminine et pagnes africains de qualité. Confection sur mesure disponible.",
        category: "mode", commune: "Cocody", hours: "Lun–Sam : 09h–20h",
        whatsapp: "0702030405", socials: { instagram: "elegance_ci", facebook: "EleganceAbidjan" },
        revenueSim: 0, createdAt: now - 30 * day,
      },
      {
        id: "sto_2", ownerId: "usr_v2", name: "HighTech CI",
        logo: UI.placeholder("HighTech"), banner: UI.placeholder("Tech"),
        description: "Smartphones, accessoires et gadgets électroniques. Garantie et service après-vente.",
        category: "electronique", commune: "Marcory", hours: "Lun–Sam : 08h30–19h",
        whatsapp: "0703040506", socials: { instagram: "hightech_ci" },
        revenueSim: 0, createdAt: now - 28 * day,
      },
      {
        id: "sto_3", ownerId: "usr_v3", name: "Saveurs du Terroir",
        logo: UI.placeholder("Saveurs"), banner: UI.placeholder("Alimentation"),
        description: "Produits locaux : attiéké, épices, huile rouge, condiments et paniers gourmands.",
        category: "alimentation", commune: "Yopougon", hours: "Tous les jours : 07h–21h",
        whatsapp: "0704050607", socials: { facebook: "SaveursDuTerroir" },
        revenueSim: 0, createdAt: now - 25 * day,
      },
      {
        id: "sto_4", ownerId: "usr_v4", name: "Maison & Confort",
        logo: UI.placeholder("Maison"), banner: UI.placeholder("Déco"),
        description: "Décoration, ustensiles et petit électroménager pour embellir votre intérieur.",
        category: "maison", commune: "Treichville", hours: "Lun–Sam : 09h–18h30",
        whatsapp: "0705060708", socials: {},
        revenueSim: 0, createdAt: now - 22 * day,
      },
    ];
    DB.set(DB.KEYS.stores, stores);

    // ---- Articles (~15) ----
    const P = (o) => Object.assign({
      views: Math.floor(Math.random() * 300),
      condition: "neuf", status: "published",
      variants: { sizes: [], colors: [] }, promoPrice: 0, createdAt: now - Math.floor(Math.random() * 18) * day,
    }, o, { images: (o.imgSeeds || []).map((s) => UI.placeholder(s)) });

    const products = [
      // Élégance Abidjan
      P({ id: "prd_1", storeId: "sto_1", title: "Robe pagne wax élégante", description: "Robe cintrée en tissu wax authentique. Coupe moderne, idéale pour cérémonies et sorties.", price: 25000, promoPrice: 18500, stock: 12, category: "mode", imgSeeds: ["Robe", "Wax", "Mode"], variants: { sizes: ["S", "M", "L", "XL"], colors: ["Bleu", "Rouge", "Jaune"] } }),
      P({ id: "prd_2", storeId: "sto_1", title: "Ensemble bogolan homme", description: "Ensemble traditionnel en bogolan, chemise + pantalon. Tissu respirant.", price: 32000, stock: 8, category: "mode", imgSeeds: ["Bogolan", "Homme"], variants: { sizes: ["M", "L", "XL"], colors: ["Marron", "Noir"] } }),
      P({ id: "prd_3", storeId: "sto_1", title: "Sac à main cuir artisanal", description: "Sac à main en cuir véritable fait main par des artisans locaux.", price: 15000, stock: 20, category: "accessoires", imgSeeds: ["Sac", "Cuir"], variants: { colors: ["Marron", "Noir", "Beige"] } }),
      P({ id: "prd_4", storeId: "sto_1", title: "Foulard en soie imprimé", description: "Foulard léger aux motifs africains, parfait accessoire toute saison.", price: 6500, promoPrice: 4900, stock: 30, category: "accessoires", imgSeeds: ["Foulard"] }),

      // HighTech CI
      P({ id: "prd_5", storeId: "sto_2", title: "Smartphone Android 128 Go", description: "Écran 6.5\", 128 Go, 6 Go RAM, double SIM. Neuf sous emballage, garantie 12 mois.", price: 135000, promoPrice: 119000, stock: 15, category: "electronique", imgSeeds: ["Phone", "Tech", "Android"], variants: { colors: ["Noir", "Bleu"] } }),
      P({ id: "prd_6", storeId: "sto_2", title: "Écouteurs Bluetooth sans fil", description: "Écouteurs TWS avec boîtier de charge, autonomie 20h, réduction de bruit.", price: 18000, promoPrice: 12500, stock: 40, category: "electronique", imgSeeds: ["Buds", "Audio"] }),
      P({ id: "prd_7", storeId: "sto_2", title: "Powerbank 20000 mAh", description: "Batterie externe grande capacité, charge rapide, double port USB.", price: 14000, stock: 25, category: "electronique", imgSeeds: ["Power"] }),
      P({ id: "prd_8", storeId: "sto_2", title: "Montre connectée sport", description: "Montre intelligente : fréquence cardiaque, notifications, étanche.", price: 28000, stock: 0, category: "electronique", imgSeeds: ["Watch", "Sport"], variants: { colors: ["Noir", "Rose"] } }),
      P({ id: "prd_9", storeId: "sto_2", title: "Chargeur secteur rapide 25W", description: "Chargeur mural USB-C charge rapide compatible tous appareils. Occasion, excellent état.", price: 5500, stock: 18, category: "electronique", condition: "occasion", imgSeeds: ["Charger"] }),

      // Saveurs du Terroir
      P({ id: "prd_10", storeId: "sto_3", title: "Attiéké frais (1 kg)", description: "Attiéké artisanal préparé du jour. Livraison rapide pour garantir la fraîcheur.", price: 1500, stock: 100, category: "alimentation", imgSeeds: ["Attiéké"] }),
      P({ id: "prd_11", storeId: "sto_3", title: "Huile rouge de palme (1 L)", description: "Huile de palme rouge naturelle, pressée localement. Idéale pour la cuisine ivoirienne.", price: 2500, promoPrice: 2000, stock: 60, category: "alimentation", imgSeeds: ["Huile"] }),
      P({ id: "prd_12", storeId: "sto_3", title: "Panier épices & condiments", description: "Assortiment de piments, gingembre, cube maison et épices locales.", price: 8000, stock: 22, category: "alimentation", imgSeeds: ["Épices", "Panier"] }),

      // Maison & Confort
      P({ id: "prd_13", storeId: "sto_4", title: "Service à thé 6 pièces", description: "Ensemble théière + tasses en céramique décorée motifs africains.", price: 12000, promoPrice: 9500, stock: 14, category: "maison", imgSeeds: ["Thé", "Déco"] }),
      P({ id: "prd_14", storeId: "sto_4", title: "Ventilateur rechargeable", description: "Ventilateur portable rechargeable, parfait en cas de coupure. 3 vitesses.", price: 16500, stock: 10, category: "maison", imgSeeds: ["Ventilo"] }),
      P({ id: "prd_15", storeId: "sto_4", title: "Set de rangement cuisine", description: "Boîtes de conservation hermétiques (lot de 5) pour une cuisine organisée.", price: 7500, stock: 35, category: "maison", imgSeeds: ["Rangement"] }),
      P({ id: "prd_16", storeId: "sto_4", title: "Tapis décoratif salon", description: "Tapis moelleux motifs géométriques, 160x230 cm. Occasion, très bon état.", price: 22000, promoPrice: 17000, stock: 5, category: "maison", condition: "occasion", imgSeeds: ["Tapis", "Salon"] }),
    ];
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

    // ---- Notification de bienvenue pour la cliente ----
    DB.set(DB.KEYS.notifications, [
      { id: "ntf_seed1", userId: "usr_client", type: "info", message: "Bienvenue sur Marché CI ! Découvrez les boutiques près de chez vous.", link: "#/", read: false, createdAt: now - day },
    ]);

    DB.set(DB.KEYS.seeded, true);
  }

  window.MP.Seed = { run };
})();
