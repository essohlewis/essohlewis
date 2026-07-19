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

  /* ------------------------------- Admin ------------------------------- */
  router.get("/admin/orders", requireAdmin, (req, res) => res.json({ ok: true, items: shopdb.listOrders({ status: req.query.status }) }));
  router.post("/admin/orders/:id/status", requireAdmin, (req, res) => {
    const o = shopdb.setOrderStatus(req.params.id, (req.body || {}).status);
    if (!o) return res.status(400).json({ ok: false, error: "Statut invalide ou commande introuvable." });
    res.json({ ok: true, order: o });
  });
  router.get("/admin/stats", requireAdmin, (req, res) => res.json({ ok: true, stats: shopdb.stats() }));

  return router;
};
