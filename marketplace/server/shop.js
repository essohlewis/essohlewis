/**
 * shop.js — API REST de l'espace client (montée sur /api/shop).
 * Comptes clients, catalogue, panier et commandes, persistés en base SQLite
 * (voir shopdb.js). Authentification par jeton de session (Bearer).
 */
"use strict";

const express = require("express");

module.exports = function createShopRouter(shopdb, adminToken) {
  const router = express.Router();

  // Jeton de session → req.userId (facultatif selon la route).
  function readToken(req) {
    const h = req.get("Authorization") || "";
    if (h.startsWith("Bearer ")) return h.slice(7).trim();
    return req.get("X-Shop-Token") || req.query.stoken || null;
  }
  function auth(req, res, next) {
    req.userId = shopdb.userIdForToken(readToken(req));
    if (!req.userId) return res.status(401).json({ ok: false, error: "Connexion requise." });
    next();
  }
  function maybeAuth(req, res, next) { req.userId = shopdb.userIdForToken(readToken(req)); next(); }
  function requireAdmin(req, res, next) {
    const tok = req.get("X-Admin-Token") || req.query.token;
    if (tok !== adminToken) return res.status(401).json({ ok: false, error: "Accès administrateur requis." });
    next();
  }

  router.get("/health", (req, res) => res.json({ ok: true, service: "shop", db: shopdb.available(), products: shopdb.countProducts() }));

  /* ------------------------------ Comptes ------------------------------ */
  router.post("/register", (req, res) => {
    const { name, email, phone, password } = req.body || {};
    const r = shopdb.createUser({ name, email, phone, password });
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    const token = shopdb.createSession(r.user.id);
    res.json({ ok: true, token, user: r.user });
  });
  router.post("/login", (req, res) => {
    const { email, password } = req.body || {};
    const u = shopdb.authUser(email, password);
    if (!u) return res.status(401).json({ ok: false, error: "Identifiants incorrects." });
    const token = shopdb.createSession(u.id);
    res.json({ ok: true, token, user: shopdb.publicUser(u) });
  });
  router.post("/logout", (req, res) => { shopdb.destroySession(readToken(req)); res.json({ ok: true }); });
  router.get("/me", auth, (req, res) => res.json({ ok: true, user: shopdb.getUser(req.userId) }));

  /* ------------------------------ Catalogue ---------------------------- */
  router.get("/products", (req, res) => {
    const { category, q, storeId, limit } = req.query;
    res.json({ ok: true, items: shopdb.listProducts({ category, q, storeId, limit }) });
  });
  router.get("/products/:id", (req, res) => {
    const p = shopdb.getProduct(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: "Produit introuvable." });
    res.json({ ok: true, product: p });
  });
  // Ajout / mise à jour d'un produit (admin — sert aussi à alimenter le catalogue).
  router.post("/products", requireAdmin, (req, res) => {
    const body = req.body || {};
    const items = Array.isArray(body.products) ? body.products : [body];
    const saved = items.filter((p) => p && p.name).map((p) => shopdb.upsertProduct(p));
    res.json({ ok: true, count: saved.length, items: saved });
  });

  /* -------------------------------- Panier ----------------------------- */
  router.get("/cart", auth, (req, res) => res.json({ ok: true, items: shopdb.getCart(req.userId) }));
  router.put("/cart", auth, (req, res) => res.json({ ok: true, items: shopdb.setCart(req.userId, (req.body || {}).items) }));

  /* ------------------------------ Commandes ---------------------------- */
  // Achat : client connecté OU invité (nom + téléphone + adresse requis).
  router.post("/orders", maybeAuth, (req, res) => {
    const b = req.body || {};
    if (!req.userId) {
      if (!b.customerName || !b.phone || !b.address) return res.status(400).json({ ok: false, error: "Nom, téléphone et adresse requis." });
    }
    const r = shopdb.createOrder(req.userId, b);
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, order: r.order });
  });
  router.get("/orders", auth, (req, res) => res.json({ ok: true, items: shopdb.listOrders({ userId: req.userId, status: req.query.status }) }));
  router.get("/orders/:id", maybeAuth, (req, res) => {
    const o = shopdb.getOrder(req.params.id);
    if (!o) return res.status(404).json({ ok: false, error: "Commande introuvable." });
    if (o.userId && o.userId !== req.userId) return res.status(403).json({ ok: false, error: "Accès refusé." });
    res.json({ ok: true, order: o });
  });

  /* -------------------------------- Avis ------------------------------- */
  router.post("/reviews", auth, (req, res) => {
    const b = req.body || {};
    const user = shopdb.getUser(req.userId);
    const r = shopdb.addReview(req.userId, { id: b.id, targetType: b.targetType, targetId: b.targetId, rating: b.rating, comment: b.comment, verified: b.verified, authorName: (user && user.name) || b.authorName, createdAt: b.createdAt });
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, review: r.review });
  });
  router.get("/reviews", (req, res) => {
    const { targetType, targetId } = req.query;
    res.json({ ok: true, items: shopdb.listReviews({ targetType, targetId, status: "visible" }), rating: targetId ? shopdb.ratingFor(targetType || "product", targetId) : null });
  });

  /* ------------------------------ Boutiques ---------------------------- */
  router.get("/stores", (req, res) => res.json({ ok: true, items: shopdb.listStores({ status: "approved" }) }));
  router.get("/stores/:id", (req, res) => {
    const s = shopdb.getStoreById(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: "Boutique introuvable." });
    res.json({ ok: true, store: s });
  });
  // Enregistrement / mise à jour de sa boutique (le compte connecté devient vendeur).
  router.post("/stores", auth, (req, res) => {
    const r = shopdb.upsertStore(req.userId, req.body || {});
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, store: r.store });
  });

  /* ---------------------------- Espace vendeur ------------------------- */
  router.get("/vendor/store", auth, (req, res) => res.json({ ok: true, store: shopdb.getStoreByOwner(req.userId) }));
  router.get("/vendor/sales", auth, (req, res) => {
    const s = shopdb.getStoreByOwner(req.userId);
    if (!s) return res.json({ ok: true, store: null, summary: null, lines: [] });
    const sales = shopdb.vendorSales(s.id);
    res.json({ ok: true, store: s, summary: sales.summary, lines: sales.lines });
  });

  /* ------------------- Collections génériques (données client) ------------------- */
  // Mirroring des collections localStorage (favoris, souhaits, coupons, …) par compte.
  router.get("/data", auth, (req, res) => res.json({ ok: true, collections: shopdb.getAllDocs(req.userId) }));
  router.get("/data/:collection", auth, (req, res) => {
    if (!shopdb.isSyncCollection(req.params.collection)) return res.status(400).json({ ok: false, error: "Collection inconnue." });
    res.json({ ok: true, data: shopdb.getDoc(req.userId, req.params.collection) });
  });
  router.put("/data/:collection", auth, (req, res) => {
    const r = shopdb.putDoc(req.userId, req.params.collection, (req.body || {}).data);
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true });
  });

  /* ------------------------------- Admin ------------------------------- */
  router.get("/admin/stores", requireAdmin, (req, res) => res.json({ ok: true, items: shopdb.listStores({ status: req.query.status }) }));
  router.post("/admin/stores/:id/status", requireAdmin, (req, res) => {
    const s = shopdb.setStoreStatus(req.params.id, (req.body || {}).status);
    if (!s) return res.status(400).json({ ok: false, error: "Statut invalide ou boutique introuvable." });
    res.json({ ok: true, store: s });
  });
  router.get("/admin/data", requireAdmin, (req, res) => res.json({ ok: true, collections: shopdb.listCollections() }));
  router.get("/admin/data/:collection", requireAdmin, (req, res) => res.json({ ok: true, items: shopdb.listDocs(req.params.collection) }));
  router.get("/admin/reviews", requireAdmin, (req, res) => res.json({ ok: true, items: shopdb.listReviews({ status: req.query.status }) }));
  router.post("/admin/reviews/:id/status", requireAdmin, (req, res) => {
    const r = shopdb.setReviewStatus(req.params.id, (req.body || {}).status);
    if (!r) return res.status(400).json({ ok: false, error: "Statut invalide ou avis introuvable." });
    res.json({ ok: true, review: r });
  });
  router.get("/admin/orders", requireAdmin, (req, res) => res.json({ ok: true, items: shopdb.listOrders({ status: req.query.status }) }));
  router.post("/admin/orders/:id/status", requireAdmin, (req, res) => {
    const o = shopdb.setOrderStatus(req.params.id, (req.body || {}).status);
    if (!o) return res.status(400).json({ ok: false, error: "Statut invalide ou commande introuvable." });
    res.json({ ok: true, order: o });
  });
  router.get("/admin/stats", requireAdmin, (req, res) => res.json({ ok: true, stats: shopdb.stats() }));

  return router;
};
