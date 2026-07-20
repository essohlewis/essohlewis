/**
 * seed.js — Catalogue de démonstration inséré au premier démarrage si la base
 * est vide. DÉRIVÉ DU RÉFÉRENTIEL UNIQUE partagé (../shared/catalogue.js), le
 * même que celui du front : mêmes identifiants produits, mêmes boutiques,
 * mêmes prix. Objectif « catalogue = source unique » — aucune divergence.
 *
 * Le serveur recalcule le total des commandes à partir de CE prix ; on stocke
 * donc le prix EFFECTIF (promo si active, sinon prix de base) afin qu'il
 * corresponde à ce que le client voit et paie côté front.
 */
"use strict";

const catalogue = require("../shared/catalogue");

const IMG = "/assets/placeholder.svg"; // servi par la marketplace statique

module.exports = catalogue.PRODUCTS.map((p) => ({
  id: p.id,
  storeId: p.storeId,
  storeName: catalogue.storeName(p.storeId),
  name: p.title,
  description: p.description,
  price: catalogue.effectivePrice(p),
  category: p.category,
  image: IMG,
  stock: p.stock,
}));
