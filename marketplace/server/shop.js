/**
 * shop.js — API REST de l'espace client (montée sur /api/shop).
 * Comptes clients, catalogue, panier et commandes, persistés en base SQLite
 * (voir shopdb.js). Authentification par jeton de session (Bearer).
 */
"use strict";

const express = require("express");
const payments = require("./payments");
const totp = require("./totp");

// Envoi e-mail/SMS : simulateur tant qu'aucun fournisseur n'est configuré
// (le code est renvoyé dans la réponse pour la démo). En production, brancher
// un fournisseur (SENDGRID/TWILIO…) et retirer devCode.
const NOTIFY = !!(process.env.EMAIL_PROVIDER || process.env.SMS_PROVIDER);
function delivery(code) { return NOTIFY ? { sent: true, simulated: false } : { sent: true, simulated: true, devCode: code }; }

module.exports = function createShopRouter(shopdb, adminToken, opts) {
  const router = express.Router();
  // Statut KYC d'une boutique (injecté par server.js, lecture directe du store KYC).
  // Valeurs : "approved" | "pending" | "rejected" | "none".
  const kycStatusForStore = (opts && opts.kycStatusForStore) || (() => "approved");
  // Une boutique ne peut vendre que si elle est approuvée ET son identité vérifiée (KYC).
  const isSellable = (s) => !!s && s.status === "approved" && kycStatusForStore(s.id) === "approved";
  const decorate = (s) => s && Object.assign({}, s, { kycStatus: kycStatusForStore(s.id), sellable: isSellable(s) });

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
    const sess = shopdb.createSession(r.user.id);
    const code = shopdb.createOtp("verify_email", r.user.email, r.user.id);
    res.json({ ok: true, token: sess.token, refreshToken: sess.refreshToken, expiresAt: sess.expiresAt, user: r.user, emailVerification: delivery(code) });
  });
  router.post("/login", (req, res) => {
    const { email, password } = req.body || {};
    const u = shopdb.authUser(email, password);
    if (!u) return res.status(401).json({ ok: false, error: "Identifiants incorrects." });
    if (u.twofaEnabled) return res.json({ ok: true, twofaRequired: true, email: u.email }); // 2e étape requise
    const sess = shopdb.createSession(u.id);
    res.json({ ok: true, token: sess.token, refreshToken: sess.refreshToken, expiresAt: sess.expiresAt, user: shopdb.publicUser(u) });
  });
  // Deuxième étape de connexion (2FA).
  router.post("/login/2fa", (req, res) => {
    const { email, password, code } = req.body || {};
    const u = shopdb.authUser(email, password);
    if (!u || !u.twofaEnabled) return res.status(401).json({ ok: false, error: "Identifiants incorrects." });
    if (!totp.verify(u.twofaSecret, code)) return res.status(401).json({ ok: false, error: "Code d'authentification invalide." });
    const sess = shopdb.createSession(u.id);
    res.json({ ok: true, token: sess.token, refreshToken: sess.refreshToken, expiresAt: sess.expiresAt, user: shopdb.publicUser(u) });
  });
  // Rotation du jeton d'accès via le jeton de rafraîchissement.
  router.post("/refresh", (req, res) => {
    const sess = shopdb.refreshSession((req.body || {}).refreshToken);
    if (!sess) return res.status(401).json({ ok: false, error: "Jeton de rafraîchissement invalide ou expiré." });
    res.json({ ok: true, token: sess.token, refreshToken: sess.refreshToken, expiresAt: sess.expiresAt });
  });
  router.post("/logout", (req, res) => { shopdb.destroySession(readToken(req)); res.json({ ok: true }); });
  router.post("/logout-all", auth, (req, res) => { shopdb.destroyUserSessions(req.userId); res.json({ ok: true }); });
  router.get("/sessions", auth, (req, res) => {
    const cur = readToken(req);
    res.json({ ok: true, sessions: shopdb.listSessions(req.userId).map((s) => Object.assign(s, { current: !!(cur && cur.slice(0, 8) === s.id) })) });
  });
  router.get("/me", auth, (req, res) => res.json({ ok: true, user: shopdb.getUser(req.userId) }));

  /* ---------------------- Vérification e-mail / téléphone -------------------- */
  router.post("/verify/email", (req, res) => {
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    const v = shopdb.verifyOtp("verify_email", email, (req.body || {}).code);
    if (!v) return res.status(400).json({ ok: false, error: "Code invalide ou expiré." });
    const u = shopdb.getUserByEmail(email); if (u) shopdb.setEmailVerified(u.id);
    res.json({ ok: true });
  });
  router.post("/verify/email/resend", (req, res) => {
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    const u = shopdb.getUserByEmail(email);
    if (!u) return res.json({ ok: true, sent: true, simulated: !NOTIFY }); // ne divulgue pas l'existence
    res.json({ ok: true, ...delivery(shopdb.createOtp("verify_email", email, u.id)) });
  });

  /* ------------------------ Réinitialisation mot de passe ------------------- */
  router.post("/password/forgot", (req, res) => {
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    const u = shopdb.getUserByEmail(email);
    if (!u) return res.json({ ok: true, sent: true, simulated: !NOTIFY }); // anti-énumération
    res.json({ ok: true, ...delivery(shopdb.createOtp("reset_password", email, u.id)) });
  });
  router.post("/password/reset", (req, res) => {
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    const { code, password } = req.body || {};
    const v = shopdb.verifyOtp("reset_password", email, code);
    if (!v) return res.status(400).json({ ok: false, error: "Code invalide ou expiré." });
    if (!password || String(password).length < 6) return res.status(400).json({ ok: false, error: "Mot de passe trop court (min. 6 caractères)." });
    const u = shopdb.getUserByEmail(email); if (!u) return res.status(400).json({ ok: false, error: "Compte introuvable." });
    shopdb.setUserPassword(u.id, password);
    shopdb.destroyUserSessions(u.id); // révoque toutes les sessions existantes
    res.json({ ok: true });
  });
  router.post("/password/change", auth, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const u = shopdb.getUserRaw(req.userId);
    if (!u || !shopdb.authUser(u.email, currentPassword)) return res.status(401).json({ ok: false, error: "Mot de passe actuel incorrect." });
    if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ ok: false, error: "Nouveau mot de passe trop court (min. 6 caractères)." });
    shopdb.setUserPassword(req.userId, newPassword);
    res.json({ ok: true });
  });

  /* ----------------------------- 2FA (TOTP) ------------------------------ */
  router.post("/2fa/setup", auth, (req, res) => {
    const u = shopdb.getUserRaw(req.userId);
    const secret = totp.generateSecret();
    shopdb.setTwofa(req.userId, secret, false); // stocké mais pas encore activé
    res.json({ ok: true, secret, uri: totp.uri(secret, u.email) });
  });
  router.post("/2fa/enable", auth, (req, res) => {
    const u = shopdb.getUserRaw(req.userId);
    if (!u.twofaSecret) return res.status(400).json({ ok: false, error: "Configurez d'abord la 2FA." });
    if (!totp.verify(u.twofaSecret, (req.body || {}).code)) return res.status(400).json({ ok: false, error: "Code invalide." });
    shopdb.setTwofa(req.userId, u.twofaSecret, true);
    res.json({ ok: true });
  });
  router.post("/2fa/disable", auth, (req, res) => {
    const u = shopdb.getUserRaw(req.userId);
    if (u.twofaEnabled && !totp.verify(u.twofaSecret, (req.body || {}).code)) return res.status(400).json({ ok: false, error: "Code invalide." });
    shopdb.setTwofa(req.userId, null, false);
    res.json({ ok: true });
  });

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
    // Blocage : aucune vente pour une boutique enregistrée mais non autorisée (KYC/approbation).
    const blocked = new Set();
    for (const it of (Array.isArray(b.items) ? b.items : [])) {
      if (!it || !it.storeId) continue;
      const s = shopdb.getStoreById(it.storeId);
      if (s && !isSellable(s)) blocked.add(s.name || s.id);
    }
    if (blocked.size) return res.status(403).json({ ok: false, error: "Boutique non autorisée à vendre (identité vendeur non vérifiée) : " + [...blocked].join(", ") + "." });
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

  /* ------------------------------ Paiements ---------------------------- */
  // Moyens de paiement proposés (COD toujours ; mobile money & carte selon config).
  router.get("/payments/methods", (req, res) => res.json({ ok: true, methods: payments.methods(), live: payments.LIVE }));

  // Initie un paiement pour une commande (client connecté propriétaire de la commande).
  router.post("/payments/initiate", maybeAuth, (req, res) => {
    const b = req.body || {};
    const order = shopdb.getOrder(b.orderId);
    if (!order) return res.status(404).json({ ok: false, error: "Commande introuvable." });
    if (order.userId && order.userId !== req.userId) return res.status(403).json({ ok: false, error: "Accès refusé." });
    if (order.paymentStatus === "paid") return res.status(409).json({ ok: false, error: "Commande déjà réglée." });
    const r = payments.initiate(b.method, { amount: order.total, phone: b.phone || order.phone });
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    const pay = shopdb.createPayment({ orderId: order.id, method: b.method, amount: order.total, phone: b.phone || order.phone, reference: r.reference, instructions: r.instructions, status: r.status });
    res.json({ ok: true, payment: pay, live: r.live });
  });

  // Confirmation (rappel opérateur en production ; action « J'ai payé » en démo).
  router.post("/payments/:id/confirm", (req, res) => {
    const p = shopdb.getPayment(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: "Paiement introuvable." });
    const v = payments.verify(p.method, p.reference);
    const updated = shopdb.setPaymentStatus(p.id, v.status);
    res.json({ ok: true, payment: updated });
  });

  // Webhook opérateur/agrégateur (production). Idempotent, par référence.
  router.post("/payments/webhook/:provider", (req, res) => {
    const ref = (req.body || {}).reference, status = (req.body || {}).status || "paid";
    const p = shopdb.listPayments({}).find((x) => x.reference === ref);
    if (p) shopdb.setPaymentStatus(p.id, status === "success" || status === "paid" ? "paid" : "failed");
    res.json({ ok: true });
  });

  router.get("/payments/:id", (req, res) => {
    const p = shopdb.getPayment(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: "Paiement introuvable." });
    res.json({ ok: true, payment: p });
  });

  /* ------------------------------ Boutiques ---------------------------- */
  // Vitrine publique : uniquement les boutiques autorisées à vendre (approuvées + KYC validé).
  router.get("/stores", (req, res) => res.json({ ok: true, items: shopdb.listStores({ status: "approved" }).filter(isSellable).map(decorate) }));
  router.get("/stores/:id", (req, res) => {
    const s = shopdb.getStoreById(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: "Boutique introuvable." });
    res.json({ ok: true, store: decorate(s) });
  });
  // Enregistrement / mise à jour de sa boutique (le compte connecté devient vendeur).
  router.post("/stores", auth, (req, res) => {
    const r = shopdb.upsertStore(req.userId, req.body || {});
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, store: r.store });
  });

  /* ---------------------------- Espace vendeur ------------------------- */
  router.get("/vendor/store", auth, (req, res) => res.json({ ok: true, store: decorate(shopdb.getStoreByOwner(req.userId)) }));
  router.get("/vendor/sales", auth, (req, res) => {
    const s = shopdb.getStoreByOwner(req.userId);
    if (!s) return res.json({ ok: true, store: null, summary: null, lines: [] });
    const sales = shopdb.vendorSales(s.id);
    res.json({ ok: true, store: decorate(s), summary: sales.summary, lines: sales.lines });
  });
  // Portefeuille du vendeur (escrow / disponible / commission) + ses retraits.
  router.get("/vendor/wallet", auth, (req, res) => {
    const s = shopdb.getStoreByOwner(req.userId);
    if (!s) return res.json({ ok: true, store: null, wallet: null, payouts: [] });
    res.json({ ok: true, store: decorate(s), wallet: shopdb.vendorWallet(s.id), payouts: shopdb.listPayouts({ storeId: s.id }) });
  });
  // Demande de retrait (débitée du solde disponible).
  router.post("/vendor/payouts", auth, (req, res) => {
    const s = shopdb.getStoreByOwner(req.userId);
    if (!s) return res.status(400).json({ ok: false, error: "Aucune boutique." });
    const b = req.body || {};
    const r = shopdb.createPayout(s.id, { amount: b.amount, method: b.method, details: b.details });
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, payout: r.payout, wallet: shopdb.vendorWallet(s.id) });
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
  router.get("/admin/stores", requireAdmin, (req, res) => res.json({ ok: true, items: shopdb.listStores({ status: req.query.status }).map(decorate) }));
  router.post("/admin/stores/:id/status", requireAdmin, (req, res) => {
    const s = shopdb.setStoreStatus(req.params.id, (req.body || {}).status);
    if (!s) return res.status(400).json({ ok: false, error: "Statut invalide ou boutique introuvable." });
    res.json({ ok: true, store: s });
  });
  router.get("/admin/payments", requireAdmin, (req, res) => res.json({ ok: true, items: shopdb.listPayments({ status: req.query.status }) }));
  // Journal comptable unifié + synthèse de réconciliation.
  router.get("/admin/transactions", requireAdmin, (req, res) => res.json({ ok: true, items: shopdb.transactions({ limit: req.query.limit }), reconciliation: shopdb.reconciliation() }));
  router.get("/admin/payouts", requireAdmin, (req, res) => {
    const items = shopdb.listPayouts({ status: req.query.status });
    const byStore = {};
    for (const p of items) { if (!byStore[p.storeId]) { const s = shopdb.getStoreById(p.storeId); byStore[p.storeId] = s ? s.name : p.storeId; } p.storeName = byStore[p.storeId]; }
    res.json({ ok: true, items });
  });
  router.post("/admin/payouts/:id/status", requireAdmin, (req, res) => {
    const p = shopdb.setPayoutStatus(req.params.id, (req.body || {}).status);
    if (!p) return res.status(400).json({ ok: false, error: "Statut invalide ou retrait introuvable." });
    res.json({ ok: true, payout: p });
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
  router.get("/admin/orders/:id", requireAdmin, (req, res) => {
    const o = shopdb.getOrder(req.params.id);
    if (!o) return res.status(404).json({ ok: false, error: "Commande introuvable." });
    res.json({ ok: true, order: o });
  });
  router.post("/admin/orders/:id/status", requireAdmin, (req, res) => {
    const o = shopdb.setOrderStatus(req.params.id, (req.body || {}).status);
    if (!o) return res.status(400).json({ ok: false, error: "Statut invalide ou commande introuvable." });
    res.json({ ok: true, order: o });
  });
  // Remboursement / annulation (rembourse le paiement en ligne le cas échéant).
  router.post("/admin/orders/:id/refund", requireAdmin, (req, res) => {
    const r = shopdb.refundOrder(req.params.id, (req.body || {}).reason);
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, order: r.order, refunded: r.refunded, wasPaid: r.wasPaid });
  });
  router.get("/admin/stats", requireAdmin, (req, res) => res.json({ ok: true, stats: shopdb.stats() }));

  return router;
};
