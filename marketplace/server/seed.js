/**
 * seed.js — Catalogue de démonstration inséré au premier démarrage si la base
 * est vide. Prix en FCFA, catégories typiques d'un marché ivoirien.
 */
"use strict";

const IMG = "/assets/placeholder.svg"; // servi par la marketplace statique

module.exports = [
  { id: "p_seed_riz", storeId: "s_demo1", storeName: "Alloco Market", name: "Sac de riz parfumé 25 kg", description: "Riz parfumé importé, sac de 25 kg.", price: 18500, category: "Alimentation", image: IMG, stock: 40 },
  { id: "p_seed_huile", storeId: "s_demo1", storeName: "Alloco Market", name: "Huile de palme 5 L", description: "Huile de palme rouge locale, bidon 5 litres.", price: 6500, category: "Alimentation", image: IMG, stock: 60 },
  { id: "p_seed_pagne", storeId: "s_demo2", storeName: "Tissus d'Abidjan", name: "Pagne wax 6 yards", description: "Pagne wax de qualité, 6 yards, motifs variés.", price: 12000, category: "Mode", image: IMG, stock: 25 },
  { id: "p_seed_sandales", storeId: "s_demo2", storeName: "Tissus d'Abidjan", name: "Sandales en cuir", description: "Sandales artisanales en cuir véritable.", price: 9000, category: "Mode", image: IMG, stock: 30 },
  { id: "p_seed_phone", storeId: "s_demo3", storeName: "Tech Plateau", name: "Smartphone Android 128 Go", description: "Écran 6.5\", 128 Go, double SIM.", price: 89000, category: "Électronique", image: IMG, stock: 15 },
  { id: "p_seed_ecouteurs", storeId: "s_demo3", storeName: "Tech Plateau", name: "Écouteurs sans fil", description: "Bluetooth 5.3, boîtier de charge.", price: 14500, category: "Électronique", image: IMG, stock: 50 },
  { id: "p_seed_marmite", storeId: "s_demo4", storeName: "Maison Cocody", name: "Marmite en fonte 10 L", description: "Marmite robuste pour grandes familles.", price: 22000, category: "Maison", image: IMG, stock: 18 },
  { id: "p_seed_ventilo", storeId: "s_demo4", storeName: "Maison Cocody", name: "Ventilateur sur pied", description: "3 vitesses, oscillation, silencieux.", price: 27000, category: "Maison", image: IMG, stock: 22 },
  { id: "p_seed_beurre", storeId: "s_demo5", storeName: "Karité Nature", name: "Beurre de karité pur 500 g", description: "100 % naturel, non raffiné.", price: 3500, category: "Beauté", image: IMG, stock: 80 },
  { id: "p_seed_savon", storeId: "s_demo5", storeName: "Karité Nature", name: "Savon noir africain (lot de 3)", description: "Savon noir traditionnel, lot de 3.", price: 4000, category: "Beauté", image: IMG, stock: 70 },
];
