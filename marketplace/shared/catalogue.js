/* =========================================================================
   catalogue.js — RÉFÉRENTIEL PRODUITS UNIQUE (source de vérité partagée).

   Ce fichier est le SEUL endroit où sont définis les boutiques et les articles
   de démonstration. Il est consommé à la fois par :
     • le front (navigateur)  → window.MP.Catalogue  (via <script src>)
     • le back-end Node       → require("../shared/catalogue")

   Objectif « catalogue = source unique » : le front (démo localStorage) et le
   serveur (base SQLite) partent EXACTEMENT des mêmes produits (mêmes id, noms,
   prix, boutiques). Fini les deux catalogues divergents.

   Les données sont « pures » (aucune dépendance à UI/DB) : les images sont des
   graines de texte (imgSeeds / logoSeed…) que le front transforme en
   placeholders, et les dates sont exprimées en « jours avant maintenant »
   (daysAgo). Prix en FCFA. Vocabulaire de catégories du front (minuscules).
   ========================================================================= */
(function (root, factory) {
  "use strict";
  const data = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = data;                        // Node (serveur)
  } else {
    root.MP = root.MP || {};
    root.MP.Catalogue = data;                     // Navigateur (front)
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- Boutiques (identité + présentation de démo) ----
  const STORES = [
    {
      id: "sto_1", ownerId: "usr_v1", name: "Élégance Abidjan",
      logoSeed: "Élégance", bannerSeed: "Mode",
      slogan: "La mode africaine qui vous ressemble", themeColor: "#d6336c",
      gallerySeeds: ["Atelier", "Wax", "Défilé", "Boutique", "Couture"],
      faq: "Livrez-vous en dehors d'Abidjan ? Oui, sous 48–72h selon la ville.\nFaites-vous du sur-mesure ? Oui, contactez-nous via WhatsApp.\nPeut-on payer par Wave ? Non, paiement en espèces à la livraison uniquement.",
      returnPolicy: "Échange possible sous 3 jours si l'article présente un défaut (non porté, étiquette intacte).",
      description: "Boutique de mode féminine et pagnes africains de qualité. Confection sur mesure disponible.",
      category: "mode", commune: "Cocody", hours: "Lun–Sam : 09h–20h",
      whatsapp: "0702030405", socials: { instagram: "elegance_ci", facebook: "EleganceAbidjan", tiktok: "elegance.abidjan" },
      defaultFee: 1000, freeShipThreshold: 40000, daysAgo: 30,
    },
    {
      id: "sto_2", ownerId: "usr_v2", name: "HighTech CI",
      logoSeed: "HighTech", bannerSeed: "Tech",
      slogan: "La technologie à portée de main", themeColor: "#2563eb",
      gallerySeeds: ["Store", "Phones", "Gadgets"],
      description: "Smartphones, accessoires et gadgets électroniques. Garantie et service après-vente.",
      category: "electronique", commune: "Marcory", hours: "Lun–Sam : 08h30–19h",
      whatsapp: "0703040506", socials: { instagram: "hightech_ci" }, daysAgo: 28,
    },
    {
      id: "sto_3", ownerId: "usr_v3", name: "Saveurs du Terroir",
      logoSeed: "Saveurs", bannerSeed: "Alimentation",
      description: "Produits locaux : attiéké, épices, huile rouge, condiments et paniers gourmands.",
      category: "alimentation", commune: "Yopougon", hours: "Tous les jours : 07h–21h",
      whatsapp: "0704050607", socials: { facebook: "SaveursDuTerroir" }, daysAgo: 25,
    },
    {
      id: "sto_4", ownerId: "usr_v4", name: "Maison & Confort",
      logoSeed: "Maison", bannerSeed: "Déco",
      description: "Décoration, ustensiles et petit électroménager pour embellir votre intérieur.",
      category: "maison", commune: "Treichville", hours: "Lun–Sam : 09h–18h30",
      whatsapp: "0705060708", socials: {}, daysAgo: 22,
    },
  ];

  // ---- Articles (~16) ----
  const PRODUCTS = [
    // Élégance Abidjan
    { id: "prd_1", storeId: "sto_1", title: "Robe pagne wax élégante", description: "Robe cintrée en tissu wax authentique. Coupe moderne, idéale pour cérémonies et sorties.", price: 25000, promoPrice: 18500, promoUntilDays: 2, cost: 12000, stock: 12, category: "mode", imgSeeds: ["Robe", "Wax", "Mode"], variants: { sizes: ["S", "M", "L", "XL"], colors: ["Bleu", "Rouge", "Jaune"] } },
    { id: "prd_2", storeId: "sto_1", title: "Ensemble bogolan homme", description: "Ensemble traditionnel en bogolan, chemise + pantalon. Tissu respirant.", price: 32000, stock: 8, category: "mode", imgSeeds: ["Bogolan", "Homme"], variants: { sizes: ["M", "L", "XL"], colors: ["Marron", "Noir"] } },
    { id: "prd_3", storeId: "sto_1", title: "Sac à main cuir artisanal", description: "Sac à main en cuir véritable fait main par des artisans locaux.", price: 15000, stock: 20, category: "accessoires", imgSeeds: ["Sac", "Cuir"], variants: { colors: ["Marron", "Noir", "Beige"] } },
    { id: "prd_4", storeId: "sto_1", title: "Foulard en soie imprimé", description: "Foulard léger aux motifs africains, parfait accessoire toute saison.", price: 6500, promoPrice: 4900, stock: 30, category: "accessoires", imgSeeds: ["Foulard"] },

    // HighTech CI
    { id: "prd_5", storeId: "sto_2", title: "Smartphone Android 128 Go", description: "Écran 6.5\", 128 Go, 6 Go RAM, double SIM. Neuf sous emballage, garantie 12 mois.", price: 135000, promoPrice: 119000, stock: 15, category: "electronique", imgSeeds: ["Phone", "Tech", "Android"], variants: { colors: ["Noir", "Bleu"] } },
    { id: "prd_6", storeId: "sto_2", title: "Écouteurs Bluetooth sans fil", description: "Écouteurs TWS avec boîtier de charge, autonomie 20h, réduction de bruit.", price: 18000, promoPrice: 12500, stock: 40, category: "electronique", imgSeeds: ["Buds", "Audio"] },
    { id: "prd_7", storeId: "sto_2", title: "Powerbank 20000 mAh", description: "Batterie externe grande capacité, charge rapide, double port USB.", price: 14000, stock: 25, category: "electronique", imgSeeds: ["Power"] },
    { id: "prd_8", storeId: "sto_2", title: "Montre connectée sport", description: "Montre intelligente : fréquence cardiaque, notifications, étanche.", price: 28000, stock: 0, category: "electronique", imgSeeds: ["Watch", "Sport"], variants: { colors: ["Noir", "Rose"] } },
    { id: "prd_9", storeId: "sto_2", title: "Chargeur secteur rapide 25W", description: "Chargeur mural USB-C charge rapide compatible tous appareils. Occasion, excellent état.", price: 5500, stock: 18, category: "electronique", condition: "occasion", imgSeeds: ["Charger"] },

    // Saveurs du Terroir
    { id: "prd_10", storeId: "sto_3", title: "Attiéké frais (1 kg)", description: "Attiéké artisanal préparé du jour. Livraison rapide pour garantir la fraîcheur.", price: 1500, stock: 100, category: "alimentation", imgSeeds: ["Attiéké"] },
    { id: "prd_11", storeId: "sto_3", title: "Huile rouge de palme (1 L)", description: "Huile de palme rouge naturelle, pressée localement. Idéale pour la cuisine ivoirienne.", price: 2500, promoPrice: 2000, stock: 60, category: "alimentation", imgSeeds: ["Huile"] },
    { id: "prd_12", storeId: "sto_3", title: "Panier épices & condiments", description: "Assortiment de piments, gingembre, cube maison et épices locales.", price: 8000, stock: 22, category: "alimentation", imgSeeds: ["Épices", "Panier"] },

    // Maison & Confort
    { id: "prd_13", storeId: "sto_4", title: "Service à thé 6 pièces", description: "Ensemble théière + tasses en céramique décorée motifs africains.", price: 12000, promoPrice: 9500, stock: 14, category: "maison", imgSeeds: ["Thé", "Déco"] },
    { id: "prd_14", storeId: "sto_4", title: "Ventilateur rechargeable", description: "Ventilateur portable rechargeable, parfait en cas de coupure. 3 vitesses.", price: 16500, stock: 10, category: "maison", imgSeeds: ["Ventilo"] },
    { id: "prd_15", storeId: "sto_4", title: "Set de rangement cuisine", description: "Boîtes de conservation hermétiques (lot de 5) pour une cuisine organisée.", price: 7500, stock: 35, category: "maison", imgSeeds: ["Rangement"] },
    { id: "prd_16", storeId: "sto_4", title: "Tapis décoratif salon", description: "Tapis moelleux motifs géométriques, 160x230 cm. Occasion, très bon état.", price: 22000, promoPrice: 17000, stock: 5, category: "maison", condition: "occasion", imgSeeds: ["Tapis", "Salon"] },
  ];

  /** Prix effectivement facturé (promo si présente, sinon prix de base). */
  function effectivePrice(p) { return p.promoPrice && p.promoPrice > 0 ? p.promoPrice : p.price; }

  /** Nom d'une boutique par identifiant. */
  function storeName(id) { const s = STORES.find((x) => x.id === id); return s ? s.name : ""; }

  return { STORES, PRODUCTS, effectivePrice, storeName };
});
