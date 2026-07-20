/**
 * server.js — Backend Node.js (Express) de Marché CI.
 * - Sert la marketplace front existante (statique).
 * - Fournit l'API de vérification d'identité (KYC) + reconnaissance faciale.
 * - Sert deux pages Tailwind : /verify (vendeur) et /admin/kyc (revue admin).
 */
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const db = require("./db");
const face = require("./face");
const shopdb = require("./shopdb");
const createShopRouter = require("./shop");
const seedProducts = require("./seed");
const security = require("./security");
const openapi = require("./openapi");
const webpush = require("./webpush");
const { logger, requestContext, accessLog, errorHandler } = require("./logger");

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.KYC_ADMIN_TOKEN || "admin-demo-token";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MARKETPLACE_DIR = path.join(__dirname, "..");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);              // req.ip / req.secure derrière un proxy TLS

// Versionnement de l'API : /api/v1/* est le chemin canonique. On le réécrit
// vers /api/* en amont de tout, si bien que sécurité, limiteurs et routeurs
// existants le servent sans duplication. /api/* reste un alias rétro-compatible
// (le front actuel et les intégrations en place continuent de fonctionner).
const API_VERSION = "v1";
app.use((req, res, next) => {
  const p = `/api/${API_VERSION}`;
  if (req.url === p) req.url = "/api";
  else if (req.url.startsWith(p + "/")) req.url = "/api/" + req.url.slice(p.length + 1);
  next();
});

// Corrélation + journalisation d'accès (avant tout traitement métier).
app.use(requestContext());                  // X-Request-Id + contexte de corrélation
app.use(accessLog());                       // une ligne de log par requête HTTP

app.use(security.httpsRedirect());          // HTTP→HTTPS si FORCE_HTTPS=1
app.use(security.securityHeaders());        // CSP, HSTS, X-Frame-Options, …
app.use("/api", security.cors());           // CORS restreint (ALLOWED_ORIGINS)
app.use("/api", security.originGuard());    // défense anti-CSRF (vérif. d'origine)
app.use("/api", security.rateLimit({ name: "api", windowMs: 60000, max: Number(process.env.RATE_MAX_API) || 600 }));
app.use(express.json({ limit: "16mb" }));

// Garde-fou : jeton admin par défaut interdit en production réelle.
if (process.env.NODE_ENV === "production" && ADMIN_TOKEN === "admin-demo-token") {
  logger.warn("KYC_ADMIN_TOKEN par défaut en production — définissez un jeton fort", { scope: "sécurité" });
}

// Limiteurs renforcés sur les points sensibles (avant le montage des routeurs).
app.use("/api/shop/login", security.rateLimit({ name: "login", windowMs: 60000, max: Number(process.env.RATE_MAX_AUTH) || 30 }));
app.use("/api/shop/register", security.rateLimit({ name: "register", windowMs: 60000, max: Number(process.env.RATE_MAX_AUTH) || 30 }));
app.use("/api/shop/payments/initiate", security.rateLimit({ name: "pay", windowMs: 60000, max: 60 }));
app.use("/api/kyc/submit", security.rateLimit({ name: "kyc", windowMs: 60000, max: 15 }));
// Points d'authentification sensibles (anti-brute force sur codes/2FA).
app.use("/api/shop/login/2fa", security.rateLimit({ name: "2fa", windowMs: 60000, max: Number(process.env.RATE_MAX_AUTH) || 30 }));
app.use("/api/shop/password/reset", security.rateLimit({ name: "reset", windowMs: 60000, max: Number(process.env.RATE_MAX_AUTH) || 30 }));
app.use("/api/shop/password/forgot", security.rateLimit({ name: "forgot", windowMs: 60000, max: Number(process.env.RATE_MAX_AUTH) || 30 }));
app.use("/api/shop/2fa/enable", security.rateLimit({ name: "2faen", windowMs: 60000, max: Number(process.env.RATE_MAX_AUTH) || 30 }));

let FACE_AVAILABLE = false;
face.selfTest().then((ok) => { FACE_AVAILABLE = ok; logger.info(`reconnaissance faciale : ${ok ? "opérationnelle (dlib)" : "indisponible → revue admin manuelle"}`, { scope: "face", available: ok }); });

// Base de données SQLite de l'espace client (comptes, catalogue, panier, commandes).
let SHOP_AVAILABLE = false;
try {
  SHOP_AVAILABLE = shopdb.init();
  if (SHOP_AVAILABLE && shopdb.countProducts() === 0) { seedProducts.forEach((p) => shopdb.upsertProduct(p)); logger.info(`catalogue initialisé (${seedProducts.length} produits)`, { scope: "shop" }); }
  logger.info(`base de données client : ${SHOP_AVAILABLE ? "SQLite prête (" + shopdb.countProducts() + " produits)" : "indisponible (node:sqlite absent)"}`, { scope: "shop", available: SHOP_AVAILABLE });
} catch (e) { logger.error("base de données indisponible", { scope: "shop", err: e.message }); }
// Statut KYC d'une boutique (lecture directe du store KYC) — sert à bloquer la
// vente tant que l'identité du vendeur n'est pas validée.
function kycStatusForStore(storeId) {
  if (!storeId) return "none";
  try {
    const rows = db.all().filter((r) => r.storeId === storeId).sort((a, b) => b.createdAt - a.createdAt);
    return rows[0] ? rows[0].status : "none"; // pending | approved | rejected | none
  } catch (e) { return "none"; }
}
if (SHOP_AVAILABLE) {
  // Connexion biométrique : compare un selfie au visage de référence KYC du compte.
  app.post("/api/shop/login/face", async (req, res) => {
    const b = req.body || {};
    if (!FACE_AVAILABLE) return res.status(400).json({ ok: false, error: "Reconnaissance faciale indisponible sur ce serveur." });
    const u = shopdb.getUserByEmail(b.email);
    if (!u || !b.selfie) return res.status(401).json({ ok: false, error: "Identifiants incorrects." });
    const store = shopdb.getStoreByOwner(u.id);
    const kyc = store && db.all().filter((r) => r.storeId === store.id && r.status === "approved").sort((a, c) => c.createdAt - a.createdAt)[0];
    if (!kyc || !kyc.selfieFile) return res.status(400).json({ ok: false, error: "Aucun visage de référence vérifié pour ce compte." });
    let ref;
    try { ref = "data:image/jpeg;base64," + fs.readFileSync(db.imagePath(kyc.selfieFile)).toString("base64"); }
    catch (e) { return res.status(400).json({ ok: false, error: "Référence indisponible." }); }
    let cmp;
    try { cmp = await face.compare(ref, b.selfie); } catch (e) { cmp = { available: false }; }
    if (!cmp.available) return res.status(400).json({ ok: false, error: "Comparaison indisponible." });
    if (!cmp.match) return res.status(401).json({ ok: false, error: "Visage non reconnu.", score: cmp.score });
    const sess = shopdb.createSession(u.id);
    res.json({ ok: true, token: sess.token, refreshToken: sess.refreshToken, expiresAt: sess.expiresAt, user: shopdb.publicUser(u), score: cmp.score });
  });
  /* ------------------------- Notifications Web Push ------------------------- */
  // Clés VAPID : persistantes en production (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY),
  // sinon éphémères pour la démo (les abonnements devront être repris au redémarrage).
  const VAPID = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || "mailto:admin@marche.ci",
  };
  if (!VAPID.publicKey || !VAPID.privateKey) {
    const gen = webpush.generateVapidKeys();
    VAPID.publicKey = gen.publicKey; VAPID.privateKey = gen.privateKey;
    logger.warn("clés VAPID éphémères (démo) — définissez VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY en production", { scope: "push" });
  }

  // Envoie une notification à tous les appareils abonnés d'un utilisateur.
  // Meilleur effort : purge les abonnements expirés (404/410), journalise le reste.
  async function pushToUser(userId, payload) {
    const subs = shopdb.listPushSubs(userId);
    let sent = 0, failed = 0;
    for (const sub of subs) {
      const r = await webpush.send(sub, payload, VAPID);
      if (r.ok) sent++;
      else { failed++; if (r.expired) shopdb.deletePushSub(sub.endpoint); }
    }
    if (subs.length) logger.info("push envoyé", { scope: "push", userId, sent, failed, devices: subs.length });
    return { devices: subs.length, sent, failed };
  }

  app.use("/api/shop", createShopRouter(shopdb, ADMIN_TOKEN, {
    kycStatusForStore,
    pushNotify: (userId, payload) => { pushToUser(userId, payload).catch((e) => logger.error("push échec", { scope: "push", err: e.message })); },
  }));

  // Clé publique VAPID (le navigateur en a besoin pour s'abonner).
  app.get("/api/shop/push/vapidPublicKey", (req, res) => res.json({ ok: true, key: VAPID.publicKey }));
  // Enregistre / retire un abonnement (authentifié via jeton de session).
  const pushAuth = (req, res, next) => {
    const t = (req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = t && shopdb.userIdForToken(t);
    if (!uid) return res.status(401).json({ ok: false, error: "Connexion requise." });
    req.pushUserId = uid; next();
  };
  app.post("/api/shop/push/subscribe", pushAuth, (req, res) => {
    const r = shopdb.savePushSub(req.pushUserId, (req.body || {}).subscription);
    if (r.error) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true });
  });
  app.post("/api/shop/push/unsubscribe", pushAuth, (req, res) => {
    shopdb.deletePushSub((req.body || {}).endpoint);
    res.json({ ok: true });
  });
  // Envoi d'une notification de test à soi-même (vérifie le parcours de bout en bout).
  app.post("/api/shop/push/test", pushAuth, async (req, res) => {
    const r = await pushToUser(req.pushUserId, { title: "Marché CI", body: "Notifications activées ✅", url: "/", tag: "test" });
    res.json({ ok: true, ...r });
  });
}

function requireAdmin(req, res, next) {
  const tok = req.get("X-Admin-Token") || req.query.token;
  if (tok !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Accès administrateur requis." });
  next();
}
const publicRow = (r) => ({
  id: r.id, vendorId: r.vendorId, vendorName: r.vendorName, storeId: r.storeId,
  idType: r.idType, idNumber: r.idNumber, faceDetected: r.faceDetected,
  match: r.match, score: r.score, distance: r.distance, faceAvailable: r.faceAvailable,
  liveness: r.liveness || null,
  status: r.status, reason: r.reason, createdAt: r.createdAt, reviewedAt: r.reviewedAt,
  idImageUrl: `/api/kyc/image/${r.id}/id`, selfieUrl: `/api/kyc/image/${r.id}/selfie`,
});

/* ------------------------------- API ------------------------------- */
app.get("/api/kyc/health", (req, res) => res.json({ ok: true, service: "kyc", face: FACE_AVAILABLE, liveness: FACE_AVAILABLE }));

// Vérification de vivacité (anti-photo) — appelée pendant la capture, avant l'envoi.
app.post("/api/kyc/liveness", async (req, res) => {
  const frames = (req.body || {}).frames;
  if (!FACE_AVAILABLE) return res.json({ ok: true, available: false });
  if (!Array.isArray(frames) || frames.length < 2) return res.status(400).json({ ok: false, error: "Rafale d'images requise." });
  let lv = { available: false };
  try { lv = await face.checkLiveness(frames); } catch (e) { lv = { available: false }; }
  res.json({ ok: true, available: !!lv.available, live: !!lv.live, blink: !!lv.blink, motion: !!lv.motion, reason: lv.reason || null });
});

// Soumission d'une vérification (vendeur).
app.post("/api/kyc/submit", async (req, res) => {
  const b = req.body || {};
  if (!b.vendorId) return res.status(400).json({ ok: false, error: "vendorId requis." });
  if (!b.consent) return res.status(400).json({ ok: false, error: "Consentement requis." });
  const idFile = db.saveImage(b.idImage, "id", MAX_IMAGE_BYTES);
  const selfieFile = db.saveImage(b.selfie, "selfie", MAX_IMAGE_BYTES);
  if (!idFile || !selfieFile) return res.status(400).json({ ok: false, error: "Image invalide ou trop lourde." });

  // Reconnaissance faciale (si disponible).
  let fr = { available: false };
  if (FACE_AVAILABLE) { try { fr = await face.compare(b.idImage, b.selfie); } catch (e) { fr = { available: false }; } }

  // Vivacité : re-vérifiée côté serveur à partir de la rafale (jamais faite confiance au client).
  let lv = { available: false };
  if (FACE_AVAILABLE && Array.isArray(b.frames) && b.frames.length >= 2) {
    try { lv = await face.checkLiveness(b.frames); } catch (e) { lv = { available: false }; }
  }
  const liveness = lv.available
    ? { available: true, live: !!lv.live, blink: !!lv.blink, motion: !!lv.motion, reason: lv.reason || null }
    : { available: false };

  const rows = db.all();
  // Une seule vérification active par vendeur (remplace la non approuvée).
  const prev = rows.filter((r) => r.vendorId === b.vendorId).sort((x, y) => y.createdAt - x.createdAt)[0];
  if (prev && prev.status === "approved") return res.status(409).json({ ok: false, error: "Déjà vérifié." });
  if (prev) { db.removeImage(prev.idFile); db.removeImage(prev.selfieFile); }
  const kept = rows.filter((r) => r.vendorId !== b.vendorId);

  const row = {
    id: db.uid(), vendorId: b.vendorId, vendorName: b.vendorName || "", storeId: b.storeId || "",
    idType: b.idType || "", idNumber: b.idNumber || "",
    idFile, selfieFile, faceDetected: !!b.faceDetected,
    faceAvailable: !!fr.available,
    match: fr.available ? !!fr.match : null,
    score: fr.available ? fr.score : null,
    distance: fr.available ? (fr.distance ?? null) : null,
    faceError: fr.available ? (fr.error || null) : (fr.error || null),
    liveness,
    status: "pending", reason: "", createdAt: Date.now(), reviewedAt: 0,
  };
  kept.push(row); db.saveAll(kept);
  res.json({ ok: true, id: row.id, status: "pending", faceAvailable: row.faceAvailable, match: row.match, score: row.score, liveness: row.liveness });
});

// Statut d'un vendeur.
app.get("/api/kyc/status", (req, res) => {
  const vendorId = String(req.query.vendorId || "");
  const r = db.all().filter((x) => x.vendorId === vendorId).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!r) return res.json({ ok: true, status: "none" });
  res.json({ ok: true, status: r.status, reason: r.reason, match: r.match, score: r.score, faceAvailable: r.faceAvailable, submittedAt: r.createdAt });
});

// Liste (admin).
app.get("/api/kyc/list", requireAdmin, (req, res) => {
  const status = req.query.status || "pending";
  let rows = db.all().sort((a, b) => b.createdAt - a.createdAt);
  if (status !== "all") rows = rows.filter((r) => r.status === status);
  res.json({ ok: true, face: FACE_AVAILABLE, items: rows.slice(0, 200).map(publicRow) });
});

// Décision (admin).
app.post("/api/kyc/review", requireAdmin, (req, res) => {
  const { id, decision, reason } = req.body || {};
  if (!["approve", "reject"].includes(decision)) return res.status(400).json({ ok: false, error: "Décision invalide." });
  const rows = db.all();
  const r = rows.find((x) => x.id === id);
  if (!r) return res.status(404).json({ ok: false, error: "Introuvable." });
  r.status = decision === "approve" ? "approved" : "rejected";
  r.reason = String(reason || ""); r.reviewedAt = Date.now();
  db.saveAll(rows);
  res.json({ ok: true, status: r.status });
});

// Image (admin).
app.get("/api/kyc/image/:id/:kind", requireAdmin, (req, res) => {
  const r = db.all().find((x) => x.id === req.params.id);
  if (!r) return res.sendStatus(404);
  const name = req.params.kind === "id" ? r.idFile : r.selfieFile;
  if (!name) return res.sendStatus(404);
  const p = db.imagePath(name);
  if (!fs.existsSync(p)) return res.sendStatus(404);
  res.type(name.endsWith(".png") ? "png" : "jpeg").sendFile(p);
});

/* ---------------------- Documentation de l'API --------------------- */
// Spécification OpenAPI 3.0 (JSON) — atteignable en /api/openapi.json et
// /api/v1/openapi.json (réécriture de version en amont).
const OPENAPI_SPEC = openapi.build({ version: "1.0.0", baseUrl: `/api/${API_VERSION}` });
app.get("/api/openapi.json", (req, res) => res.json(OPENAPI_SPEC));
// Page de documentation navigable (renderer autonome, sans CDN — CSP-safe).
app.get(["/api/docs", "/api-docs"], (req, res) => res.sendFile(path.join(__dirname, "public", "api-docs.html")));

/* ------------------------- Pages Tailwind -------------------------- */
app.get("/verify", (req, res) => res.sendFile(path.join(__dirname, "public", "verify.html")));
app.get("/admin/kyc", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-kyc.html")));
app.get("/admin/shop", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-shop.html")));
app.get("/mes-commandes", (req, res) => res.sendFile(path.join(__dirname, "public", "mes-commandes.html")));
app.get("/mes-ventes", (req, res) => res.sendFile(path.join(__dirname, "public", "mes-ventes.html")));
app.get("/paiement", (req, res) => res.sendFile(path.join(__dirname, "public", "paiement.html")));
app.get("/facture/:id", (req, res) => res.sendFile(path.join(__dirname, "public", "facture.html")));
app.get("/securite", (req, res) => res.sendFile(path.join(__dirname, "public", "securite.html")));
app.get("/mot-de-passe", (req, res) => res.sendFile(path.join(__dirname, "public", "mot-de-passe.html")));

// Assets du back-office (tailwind.css, etc.).
app.use(express.static(path.join(__dirname, "public")));
// Marketplace front existante.
app.use(express.static(MARKETPLACE_DIR, { index: "index.html" }));

// Gestionnaire d'erreurs terminal : réponse uniforme { ok:false, error, requestId }
// + log d'erreur corrélé. Doit être enregistré en dernier.
app.use(errorHandler());

app.listen(PORT, () => {
  logger.info(`serveur prêt sur http://localhost:${PORT}`, {
    scope: "server", port: Number(PORT),
    logLevel: process.env.LOG_LEVEL || "info",
    logFormat: process.env.LOG_FORMAT || (process.env.NODE_ENV === "production" ? "json" : "pretty"),
  });
});
