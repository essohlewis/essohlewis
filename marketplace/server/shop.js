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
  const pushNotify = (opts && opts.pushNotify) || (() => {}); // (userId, payload) → Web Push (rappels commande…)
  // Une boutique ne peut vendre que si elle est approuvée ET son identité vérifiée (KYC).
  const isSellable = (s) => !!s && s.status === "approved" && kycStatusForStore(s.id) === "approved";
  const decorate = (s) => s && Object.assign({}, s, { kycStatus: kycStatusForStore(s.id), sellable: isSellable(s) });

  // Jeton de session → req.userId (facultatif selon la route).
  function readToken(req) {
    const h = req.get("Authorization") || "";
    if (h.startsWith("Bearer ")) return h.slice(7).trim();
    return req.get("X-Shop-Token") || req.query.stoken || null;
  }
  // Pagination : ?limit&offset → { items, total, limit, offset, hasMore }.
  function page(req, arr) {
    const total = arr.length;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    return { items: arr.slice(offset, offset + limit), total, limit, offset, hasMore: offset + limit < total };
  }
  // Comptes promus administrateurs (liste d'e-mails, séparés par des virgules).
  const ADMIN_EMAILS = new Set((process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  const roleOf = (userId) => { const u = userId && shopdb.getUserRaw(userId); return u ? u.role : null; };

  function auth(req, res, next) {
    req.userId = shopdb.userIdForToken(readToken(req));
    if (!req.userId) return res.status(401).json({ ok: false, error: "Connexion requise." });
    next();
  }
  function maybeAuth(req, res, next) { req.userId = shopdb.userIdForToken(readToken(req)); next(); }
  // Contrôle d'accès par rôle : client / vendeur / admin.
  function requireRole(...roles) {
    return (req, res, next) => {
      req.userId = shopdb.userIdForToken(readToken(req));
      if (!req.userId) return res.status(401).json({ ok: false, error: "Connexion requise." });
      const role = roleOf(req.userId);
      if (role === "admin" || roles.includes(role)) { req.userRole = role; return next(); }
      return res.status(403).json({ ok: false, error: "Accès réservé au rôle : " + roles.join(" / ") + "." });
    };
  }
  // Admin : soit le jeton d'administration, soit un compte de rôle « admin ».
  function requireAdmin(req, res, next) {
    const tok = req.get("X-Admin-Token") || req.query.token;
    if (tok === adminToken) return next();
    const uid = shopdb.userIdForToken(readToken(req));
    if (uid && roleOf(uid) === "admin") { req.userId = uid; return next(); }
    return res.status(401).json({ ok: false, error: "Accès administrateur requis." });
  }

  router.get("/health", (req, res) => res.json({ ok: true, service: "shop", db: shopdb.available(), products: shopdb.countProducts() }));

  /* ------------------------------ Comptes ------------------------------ */
  router.post("/register", (req, res) => {
    const { name, email, phone, password } = req.body || {};
    const r = shopdb.createUser({ name, email, phone, password });
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    if (ADMIN_EMAILS.has(r.user.email)) { shopdb.setRole(r.user.id, "admin"); r.user.role = "admin"; } // promotion admin
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
  // Déconnexion à distance d'un appareil précis.
  router.post("/sessions/:id/revoke", auth, (req, res) => {
    const okRevoke = shopdb.revokeSession(req.userId, req.params.id);
    if (!okRevoke) return res.status(404).json({ ok: false, error: "Session introuvable." });
    res.json({ ok: true });
  });

  /* ------------------------ Connexion par OTP téléphone --------------------- */
  router.post("/login/otp/request", (req, res) => {
    const phone = String((req.body || {}).phone || "").replace(/\s+/g, "");
    const u = shopdb.getUserByPhone(phone);
    if (!u) return res.json({ ok: true, sent: true, simulated: !NOTIFY }); // anti-énumération
    res.json({ ok: true, ...delivery(shopdb.createOtp("login_phone", phone, u.id)) });
  });
  router.post("/login/otp/verify", (req, res) => {
    const phone = String((req.body || {}).phone || "").replace(/\s+/g, "");
    const v = shopdb.verifyOtp("login_phone", phone, (req.body || {}).code);
    if (!v) return res.status(401).json({ ok: false, error: "Code invalide ou expiré." });
    const u = shopdb.getUserByPhone(phone);
    if (!u) return res.status(401).json({ ok: false, error: "Compte introuvable." });
    if (!u.phoneVerified) { shopdb.setPhoneVerified(u.id); u.phoneVerified = 1; } // connexion OTP → téléphone vérifié
    const sess = shopdb.createSession(u.id);
    res.json({ ok: true, token: sess.token, refreshToken: sess.refreshToken, expiresAt: sess.expiresAt, user: shopdb.publicUser(u) });
  });
  router.get("/me", auth, (req, res) => res.json({ ok: true, user: shopdb.getUser(req.userId), loyaltyPoints: shopdb.loyaltyBalance(req.userId) }));
  // Fidélité : solde, règles et journal des points du client connecté.
  router.get("/loyalty", auth, (req, res) => res.json({
    ok: true,
    balance: shopdb.loyaltyBalance(req.userId),
    rules: shopdb.LOYALTY_RULES,
    ledger: shopdb.loyaltyLedger(req.userId, req.query.limit),
  }));

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
    const { category, q, storeId } = req.query;
    res.json({ ok: true, ...page(req, shopdb.listProducts({ category, q, storeId, limit: 1000 })) });
  });
  // Recherche plein texte pondérée (pertinence + tolérance aux fautes, accents).
  router.get("/products/search", (req, res) => {
    const { q, category, storeId } = req.query;
    res.json({ ok: true, q: q || "", ...page(req, shopdb.searchProducts(q, { category, storeId, limit: 500 })) });
  });
  // Facettes : compteurs par catégorie / boutique / tranche de prix sur le résultat.
  router.get("/products/facets", (req, res) => res.json(Object.assign({ ok: true }, shopdb.facets({ q: req.query.q, storeId: req.query.storeId }))));
  // Recommandations personnalisées (catégories déjà achetées ; repli populaires).
  router.get("/recommendations", maybeAuth, (req, res) => res.json({ ok: true, items: shopdb.recommendFor(req.userId, req.query.limit) }));
  router.get("/products/:id", (req, res) => {
    const p = shopdb.getProduct(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: "Produit introuvable." });
    res.json({ ok: true, product: p });
  });
  // Produits liés : « souvent achetés ensemble » + repli même catégorie.
  router.get("/products/:id/related", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 4, 20);
    let items = shopdb.boughtTogether(req.params.id, limit);
    if (items.length < limit) {
      const p = shopdb.getProduct(req.params.id);
      const seen = new Set([req.params.id, ...items.map((x) => x.id)]);
      if (p) for (const c of shopdb.listProducts({ category: p.category, limit: 50 })) { if (!seen.has(c.id)) { items.push(c); seen.add(c.id); } if (items.length >= limit) break; }
    }
    res.json({ ok: true, items });
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
    res.json({ ok: true, ...page(req, shopdb.listReviews({ targetType, targetId, status: "visible" })), rating: targetId ? shopdb.ratingFor(targetType || "product", targetId) : null });
  });

  /* ----------------------- Questions / réponses produit ---------------- */
  router.post("/questions", auth, (req, res) => {
    const b = req.body || {};
    const user = shopdb.getUser(req.userId);
    const r = shopdb.createQuestion(req.userId, { productId: b.productId, storeId: b.storeId, question: b.question, authorName: (user && user.name) || b.authorName });
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, question: r.question });
  });
  router.get("/questions", (req, res) => res.json({ ok: true, ...page(req, shopdb.listQuestions({ productId: req.query.productId, storeId: req.query.storeId, status: "visible" })) }));
  // Réponse du vendeur (propriétaire de la boutique) ou d'un admin.
  router.post("/questions/:id/answer", auth, (req, res) => {
    const u = shopdb.getUser(req.userId);
    const isAdmin = !!(u && u.role === "admin");
    const r = shopdb.answerQuestion(req.params.id, req.userId, (req.body || {}).answer, isAdmin);
    if (r.error) return res.status(r.error.includes("Réservé") ? 403 : 400).json({ ok: false, error: r.error });
    res.json({ ok: true, question: r.question });
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
    if (roleOf(req.userId) === "client") shopdb.setRole(req.userId, "vendor"); // devient vendeur
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
  // Demande de retrait (débitée du solde disponible) — réservée aux vendeurs.
  router.post("/vendor/payouts", requireRole("vendor"), (req, res) => {
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
  // Horodatages par collection : l'appareil compare pour ne tirer que le plus récent.
  // (Déclaré AVANT /data/:collection pour ne pas être capté comme une collection.)
  router.get("/data/meta", auth, (req, res) => res.json({ ok: true, meta: shopdb.getDocsMeta(req.userId) }));
  router.get("/data/:collection", auth, (req, res) => {
    if (!shopdb.isSyncCollection(req.params.collection)) return res.status(400).json({ ok: false, error: "Collection inconnue." });
    const d = shopdb.getDocWithMeta(req.userId, req.params.collection);
    res.json({ ok: true, data: d.data, updatedAt: d.updatedAt });
  });
  router.put("/data/:collection", auth, (req, res) => {
    const r = shopdb.putDoc(req.userId, req.params.collection, (req.body || {}).data);
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, updatedAt: r.updatedAt });
  });

  /* ------------------------------- Admin ------------------------------- */
  router.get("/admin/stores", requireAdmin, (req, res) => res.json({ ok: true, ...page(req, shopdb.listStores({ status: req.query.status }).map(decorate)) }));
  router.post("/admin/stores/:id/status", requireAdmin, (req, res) => {
    const s = shopdb.setStoreStatus(req.params.id, (req.body || {}).status);
    if (!s) return res.status(400).json({ ok: false, error: "Statut invalide ou boutique introuvable." });
    res.json({ ok: true, store: s });
  });
  router.get("/admin/payments", requireAdmin, (req, res) => res.json({ ok: true, ...page(req, shopdb.listPayments({ status: req.query.status })) }));
  // Journal comptable unifié + synthèse de réconciliation.
  router.get("/admin/transactions", requireAdmin, (req, res) => res.json({ ok: true, ...page(req, shopdb.transactions({ limit: 5000 })), reconciliation: shopdb.reconciliation() }));
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
  router.get("/admin/questions", requireAdmin, (req, res) => res.json({ ok: true, ...page(req, shopdb.listQuestions({ status: req.query.status })) }));
  router.post("/admin/questions/:id/status", requireAdmin, (req, res) => {
    const q = shopdb.setQuestionStatus(req.params.id, (req.body || {}).status);
    if (!q) return res.status(400).json({ ok: false, error: "Statut invalide ou question introuvable." });
    res.json({ ok: true, question: q });
  });
  router.get("/admin/orders", requireAdmin, (req, res) => res.json({ ok: true, ...page(req, shopdb.listOrders({ status: req.query.status })) }));
  router.get("/admin/orders/:id", requireAdmin, (req, res) => {
    const o = shopdb.getOrder(req.params.id);
    if (!o) return res.status(404).json({ ok: false, error: "Commande introuvable." });
    res.json({ ok: true, order: o });
  });
  const STATUS_LABEL = { pending: "reçue", confirmed: "confirmée", shipped: "expédiée", delivered: "livrée", cancelled: "annulée" };
  router.post("/admin/orders/:id/status", requireAdmin, (req, res) => {
    const o = shopdb.setOrderStatus(req.params.id, (req.body || {}).status);
    if (!o) return res.status(400).json({ ok: false, error: "Statut invalide ou commande introuvable." });
    // À la livraison : crédite les points de fidélité (idempotent par commande).
    let loyalty = null;
    if (o.userId && o.status === "delivered") {
      const earned = shopdb.loyaltyEarnedFor(o.itemsTotal);
      const r = shopdb.awardLoyalty(o.userId, o.id, earned, "earn");
      if (r.ok) { loyalty = { earned, balance: r.balance }; pushNotify(o.userId, { title: "Marché CI — points gagnés", body: `+${earned} points de fidélité sur votre commande livrée.`, url: "/mes-commandes", tag: "loyalty-" + o.id }); }
    }
    // Rappel commande (notification push) au client concerné, s'il est abonné.
    if (o.userId) pushNotify(o.userId, {
      title: "Marché CI — votre commande",
      body: `Votre commande ${o.id} est ${STATUS_LABEL[o.status] || o.status}.`,
      url: "/mes-commandes", tag: "order-" + o.id,
    });
    res.json({ ok: true, order: o, loyalty });
  });
  // Remboursement / annulation (rembourse le paiement en ligne le cas échéant).
  router.post("/admin/orders/:id/refund", requireAdmin, (req, res) => {
    const r = shopdb.refundOrder(req.params.id, (req.body || {}).reason);
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, order: r.order, refunded: r.refunded, wasPaid: r.wasPaid });
  });
  router.get("/admin/stats", requireAdmin, (req, res) => res.json({ ok: true, stats: shopdb.stats() }));

  /* ---------------- Schéma, sauvegarde & restauration ---------------- */
  router.get("/admin/schema", requireAdmin, (req, res) => res.json({
    ok: true,
    version: shopdb.schemaVersion(),
    migrations: require("./migrations").MIGRATIONS.map((m) => ({ version: m.version, name: m.name })),
  }));
  // Export complet de la base (JSON) — à archiver hors ligne.
  router.get("/admin/backup", requireAdmin, (req, res) => res.json({ ok: true, backup: shopdb.backup() }));
  // Restauration : remplace intégralement le contenu des tables (transaction).
  router.post("/admin/restore", requireAdmin, (req, res) => {
    const r = shopdb.restore((req.body || {}).backup);
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, ...r });
  });

  return router;
};
