/**
 * shopdb.js — Base de données SQLite de l'espace client de Marché CI.
 *
 * Utilise le module SQLite *intégré* à Node.js (node:sqlite, Node 22+), donc
 * aucune dépendance à installer et aucun service externe. La base est un simple
 * fichier (`data/marche.db`). Persiste : comptes clients, catalogue produits,
 * paniers, commandes (achats, paiement à la livraison) et sessions.
 *
 * Toute l'API est synchrone (DatabaseSync) — pratique pour un back-office léger.
 */
"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let DatabaseSync;
try { ({ DatabaseSync } = require("node:sqlite")); }
catch (e) { DatabaseSync = null; } // SQLite indisponible → l'API shop se désactive proprement.

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = process.env.SHOP_DB || path.join(DATA_DIR, "marche.db");
// Commission plateforme prélevée sur chaque vente (0.10 = 10 %).
const COMMISSION_RATE = Math.min(0.9, Math.max(0, parseFloat(process.env.COMMISSION_RATE || "0.10")));

let db = null;

function available() { return !!db; }

function init() {
  if (!DatabaseSync) return false;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, phone TEXT,
      passHash TEXT, passSalt TEXT, role TEXT DEFAULT 'client', createdAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, storeId TEXT, storeName TEXT, name TEXT, description TEXT,
      price INTEGER, currency TEXT DEFAULT 'FCFA', category TEXT, image TEXT,
      stock INTEGER DEFAULT 0, active INTEGER DEFAULT 1, createdAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS carts (
      userId TEXT PRIMARY KEY, items TEXT, updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, userId TEXT, customerName TEXT, phone TEXT, address TEXT,
      city TEXT, itemsTotal INTEGER DEFAULT 0, deliveryFee INTEGER DEFAULT 0, discount INTEGER DEFAULT 0,
      total INTEGER, currency TEXT DEFAULT 'FCFA', payment TEXT DEFAULT 'cod',
      paymentMethod TEXT DEFAULT 'cod', paymentStatus TEXT DEFAULT 'cod',
      status TEXT DEFAULT 'pending', note TEXT, createdAt INTEGER, updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, orderId TEXT, method TEXT, amount INTEGER, phone TEXT,
      reference TEXT, instructions TEXT, status TEXT DEFAULT 'pending', createdAt INTEGER, updatedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_pay_order ON payments(orderId);
    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY, storeId TEXT, amount INTEGER, method TEXT, details TEXT,
      status TEXT DEFAULT 'requested', createdAt INTEGER, updatedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_payouts_store ON payouts(storeId);
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, orderId TEXT, productId TEXT,
      name TEXT, price INTEGER, qty INTEGER, variant TEXT, storeId TEXT, storeName TEXT
    );
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY, ownerId TEXT, name TEXT, description TEXT, category TEXT,
      commune TEXT, logo TEXT, status TEXT DEFAULT 'pending', createdAt INTEGER, updatedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_items_store ON order_items(storeId);
    CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(ownerId);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, userId TEXT, createdAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY, targetType TEXT, targetId TEXT, userId TEXT,
      authorName TEXT, rating INTEGER, comment TEXT, verified INTEGER DEFAULT 0,
      status TEXT DEFAULT 'visible', createdAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(targetType, targetId);
    CREATE TABLE IF NOT EXISTS documents (
      collection TEXT, userId TEXT, data TEXT, updatedAt INTEGER,
      PRIMARY KEY (collection, userId)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userId);
    CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(orderId);
    CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category);
  `);
  // Migrations légères pour les bases créées avant l'ajout de ces colonnes.
  for (const col of ["itemsTotal INTEGER DEFAULT 0", "deliveryFee INTEGER DEFAULT 0", "discount INTEGER DEFAULT 0"]) {
    try { db.exec(`ALTER TABLE orders ADD COLUMN ${col}`); } catch (e) { /* colonne déjà présente */ }
  }
  for (const col of ["storeId TEXT", "storeName TEXT"]) {
    try { db.exec(`ALTER TABLE order_items ADD COLUMN ${col}`); } catch (e) { /* déjà présente */ }
  }
  for (const col of ["paymentMethod TEXT DEFAULT 'cod'", "paymentStatus TEXT DEFAULT 'cod'"]) {
    try { db.exec(`ALTER TABLE orders ADD COLUMN ${col}`); } catch (e) { /* déjà présente */ }
  }
  return true;
}

/* --------------------------------- Utils --------------------------------- */
const now = () => Date.now();
const uid = (p) => (p || "id") + "_" + crypto.randomBytes(7).toString("hex");
function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(String(pw), salt, 32).toString("hex");
  return { passHash: h, passSalt: salt };
}
function verifyPassword(pw, hash, salt) {
  if (!hash || !salt) return false;
  const h = crypto.scryptSync(String(pw), salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

/* --------------------------------- Users --------------------------------- */
function createUser({ name, email, phone, password, role }) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !password) return { error: "email et mot de passe requis" };
  if (db.prepare("SELECT 1 FROM users WHERE email=?").get(e)) return { error: "Cet email est déjà utilisé." };
  const { passHash, passSalt } = hashPassword(password);
  const u = { id: uid("u"), name: name || "", email: e, phone: phone || "", passHash, passSalt, role: role || "client", createdAt: now() };
  db.prepare("INSERT INTO users (id,name,email,phone,passHash,passSalt,role,createdAt) VALUES (?,?,?,?,?,?,?,?)")
    .run(u.id, u.name, u.email, u.phone, u.passHash, u.passSalt, u.role, u.createdAt);
  return { user: publicUser(u) };
}
function authUser(email, password) {
  const e = String(email || "").trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE email=?").get(e);
  if (!row || !verifyPassword(password, row.passHash, row.passSalt)) return null;
  return row;
}
function getUser(id) { const r = db.prepare("SELECT * FROM users WHERE id=?").get(id); return r ? publicUser(r) : null; }
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, createdAt: u.createdAt });

/* ------------------------------- Sessions -------------------------------- */
function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token,userId,createdAt) VALUES (?,?,?)").run(token, userId, now());
  return token;
}
function userIdForToken(token) {
  if (!token) return null;
  const r = db.prepare("SELECT userId FROM sessions WHERE token=?").get(token);
  return r ? r.userId : null;
}
function destroySession(token) { if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token); }

/* ------------------------------- Products -------------------------------- */
function upsertProduct(p) {
  const row = {
    id: p.id || uid("p"), storeId: p.storeId || "", storeName: p.storeName || "",
    name: p.name || "", description: p.description || "", price: Math.max(0, parseInt(p.price, 10) || 0),
    currency: p.currency || "FCFA", category: p.category || "", image: p.image || "",
    stock: p.stock == null ? 0 : parseInt(p.stock, 10) || 0, active: p.active === false ? 0 : 1,
    createdAt: p.createdAt || now(),
  };
  db.prepare(`INSERT INTO products (id,storeId,storeName,name,description,price,currency,category,image,stock,active,createdAt)
    VALUES (@id,@storeId,@storeName,@name,@description,@price,@currency,@category,@image,@stock,@active,@createdAt)
    ON CONFLICT(id) DO UPDATE SET storeId=@storeId,storeName=@storeName,name=@name,description=@description,
      price=@price,currency=@currency,category=@category,image=@image,stock=@stock,active=@active`).run(row);
  return row;
}
function listProducts({ category, q, storeId, limit } = {}) {
  let sql = "SELECT * FROM products WHERE active=1", args = {};
  if (category) { sql += " AND category=@category"; args.category = category; }
  if (storeId) { sql += " AND storeId=@storeId"; args.storeId = storeId; }
  if (q) { sql += " AND (name LIKE @q OR description LIKE @q)"; args.q = "%" + q + "%"; }
  sql += " ORDER BY createdAt DESC LIMIT @limit"; args.limit = Math.min(parseInt(limit, 10) || 200, 500);
  return db.prepare(sql).all(args);
}
function getProduct(id) { if (id == null || id === "") return null; return db.prepare("SELECT * FROM products WHERE id=?").get(String(id)) || null; }
function countProducts() { return db.prepare("SELECT COUNT(*) c FROM products").get().c; }

/* --------------------------------- Carts --------------------------------- */
function getCart(userId) {
  const r = db.prepare("SELECT items FROM carts WHERE userId=?").get(userId);
  try { return r ? JSON.parse(r.items) : []; } catch (e) { return []; }
}
function setCart(userId, items) {
  db.prepare("INSERT INTO carts (userId,items,updatedAt) VALUES (?,?,?) ON CONFLICT(userId) DO UPDATE SET items=excluded.items,updatedAt=excluded.updatedAt")
    .run(userId, JSON.stringify(items || []), now());
  return items || [];
}

/* -------------------------------- Orders --------------------------------- */
function createOrder(userId, payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { error: "Panier vide." };
  // Recalcule le sous-total articles côté serveur (jamais faire confiance au client
  // sur les prix). On applique ensuite la remise et les frais de livraison fournis.
  let itemsTotal = 0;
  const resolved = [];
  for (const it of items) {
    const prod = it.productId ? getProduct(it.productId) : null;
    const price = prod ? prod.price : Math.max(0, parseInt(it.price, 10) || 0);
    const name = prod ? prod.name : (it.name || "Article");
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    itemsTotal += price * qty;
    resolved.push({ productId: it.productId || "", name, price, qty, variant: it.variant || "",
      storeId: (prod && prod.storeId) || it.storeId || "", storeName: (prod && prod.storeName) || it.storeName || "" });
  }
  const deliveryFee = Math.max(0, parseInt(payload.deliveryFee, 10) || 0);
  const discount = Math.max(0, parseInt(payload.discount, 10) || 0);
  const total = Math.max(0, itemsTotal - discount) + deliveryFee;
  const paymentMethod = payload.paymentMethod || "cod";
  const o = {
    id: uid("cmd"), userId: userId || null,
    customerName: payload.customerName || "", phone: payload.phone || "", address: payload.address || "",
    city: payload.city || "", itemsTotal, deliveryFee, discount, total, currency: "FCFA", payment: payload.payment || "cod",
    paymentMethod, paymentStatus: paymentMethod === "cod" ? "cod" : "pending",
    status: "pending", note: payload.note || "", createdAt: now(), updatedAt: now(),
  };
  const insertOrder = db.prepare(`INSERT INTO orders (id,userId,customerName,phone,address,city,itemsTotal,deliveryFee,discount,total,currency,payment,paymentMethod,paymentStatus,status,note,createdAt,updatedAt)
    VALUES (@id,@userId,@customerName,@phone,@address,@city,@itemsTotal,@deliveryFee,@discount,@total,@currency,@payment,@paymentMethod,@paymentStatus,@status,@note,@createdAt,@updatedAt)`);
  const insertItem = db.prepare("INSERT INTO order_items (orderId,productId,name,price,qty,variant,storeId,storeName) VALUES (?,?,?,?,?,?,?,?)");
  const decStock = db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id=? AND stock > 0");
  // node:sqlite n'a pas de helper transaction() → BEGIN/COMMIT manuels.
  db.exec("BEGIN");
  try {
    insertOrder.run(o);
    for (const r of resolved) { insertItem.run(o.id, r.productId, r.name, r.price, r.qty, r.variant, r.storeId, r.storeName); if (r.productId) decStock.run(r.qty, r.productId); }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); return { error: "Échec de l'enregistrement de la commande." }; }
  if (userId) setCart(userId, []); // vide le panier après achat
  return { order: getOrder(o.id) };
}
function getOrder(id) {
  const o = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!o) return null;
  o.items = db.prepare("SELECT productId,name,price,qty,variant,storeName FROM order_items WHERE orderId=?").all(id);
  return o;
}
function listOrders({ userId, status, limit } = {}) {
  let sql = "SELECT * FROM orders WHERE 1=1", args = {};
  if (userId) { sql += " AND userId=@userId"; args.userId = userId; }
  if (status && status !== "all") { sql += " AND status=@status"; args.status = status; }
  sql += " ORDER BY createdAt DESC LIMIT @limit"; args.limit = Math.min(parseInt(limit, 10) || 200, 1000);
  const rows = db.prepare(sql).all(args);
  const itemsStmt = db.prepare("SELECT productId,name,price,qty,variant,storeName FROM order_items WHERE orderId=?");
  for (const r of rows) r.items = itemsStmt.all(r.id);
  return rows;
}
function setOrderStatus(id, status) {
  const ok = ["pending", "confirmed", "shipped", "delivered", "cancelled"].includes(status);
  if (!ok) return null;
  db.prepare("UPDATE orders SET status=?,updatedAt=? WHERE id=?").run(status, now(), id);
  return getOrder(id);
}
/**
 * Annule une commande et rembourse le paiement en ligne le cas échéant.
 * Un remboursement retire aussi les fonds du portefeuille vendeur (la commande
 * annulée est exclue de l'escrow/du disponible).
 */
function refundOrder(id, reason) {
  const o = getOrder(id);
  if (!o) return { error: "Commande introuvable." };
  if (o.status === "cancelled" && o.paymentStatus === "refunded") return { error: "Déjà remboursée." };
  let refunded = 0;
  // Marque les paiements encaissés comme remboursés.
  for (const p of paymentsForOrder(id)) {
    if (p.status === "paid") { db.prepare("UPDATE payments SET status='refunded',updatedAt=? WHERE id=?").run(now(), p.id); refunded += p.amount; }
  }
  const wasPaid = o.paymentStatus === "paid" || refunded > 0;
  db.prepare("UPDATE orders SET status='cancelled',paymentStatus=?,note=?,updatedAt=? WHERE id=?")
    .run(wasPaid ? "refunded" : (o.paymentStatus === "cod" ? "cod" : "cancelled"),
      reason ? (o.note ? o.note + " · " : "") + "Annulée : " + reason : o.note, now(), id);
  return { order: getOrder(id), refunded, wasPaid };
}
function stats() {
  return {
    users: db.prepare("SELECT COUNT(*) c FROM users").get().c,
    products: countProducts(),
    orders: db.prepare("SELECT COUNT(*) c FROM orders").get().c,
    revenue: db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN ('confirmed','shipped','delivered')").get().s,
    reviews: db.prepare("SELECT COUNT(*) c FROM reviews").get().c,
    documents: db.prepare("SELECT COUNT(*) c FROM documents").get().c,
    stores: db.prepare("SELECT COUNT(*) c FROM stores").get().c,
    paidOnline: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status='paid'").get().s,
    commission: Math.round(db.prepare("SELECT COALESCE(SUM(oi.price*oi.qty),0) g FROM order_items oi JOIN orders o ON o.id=oi.orderId WHERE o.status='delivered'").get().g * COMMISSION_RATE),
    payoutsPaid: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payouts WHERE status='paid'").get().s,
    refunded: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status='refunded'").get().s,
    commissionRate: COMMISSION_RATE,
  };
}

/* -------------------------------- Avis ----------------------------------- */
function addReview(userId, p) {
  const rating = Math.max(1, Math.min(5, parseInt(p.rating, 10) || 0));
  if (!p.targetId || !rating) return { error: "Cible et note requises." };
  const r = {
    id: p.id || uid("rev"), targetType: p.targetType === "store" ? "store" : "product",
    targetId: String(p.targetId), userId: userId || null, authorName: p.authorName || "Client",
    rating, comment: String(p.comment || "").trim(), verified: p.verified ? 1 : 0,
    status: "visible", createdAt: p.createdAt || now(),
  };
  db.prepare(`INSERT INTO reviews (id,targetType,targetId,userId,authorName,rating,comment,verified,status,createdAt)
    VALUES (@id,@targetType,@targetId,@userId,@authorName,@rating,@comment,@verified,@status,@createdAt)
    ON CONFLICT(id) DO UPDATE SET rating=@rating,comment=@comment`).run(r);
  return { review: r };
}
function listReviews({ targetType, targetId, status } = {}) {
  let sql = "SELECT * FROM reviews WHERE 1=1", args = {};
  if (targetType) { sql += " AND targetType=@targetType"; args.targetType = targetType; }
  if (targetId) { sql += " AND targetId=@targetId"; args.targetId = String(targetId); }
  if (status && status !== "all") { sql += " AND status=@status"; args.status = status; }
  sql += " ORDER BY createdAt DESC LIMIT 500";
  return db.prepare(sql).all(args);
}
function ratingFor(targetType, targetId) {
  const r = db.prepare("SELECT COUNT(*) c, COALESCE(AVG(rating),0) a FROM reviews WHERE targetType=? AND targetId=? AND status='visible'").get(targetType, String(targetId));
  return { count: r.c, average: Math.round(r.a * 10) / 10 };
}
function setReviewStatus(id, status) {
  if (!["visible", "hidden"].includes(status)) return null;
  db.prepare("UPDATE reviews SET status=? WHERE id=?").run(status, id);
  return db.prepare("SELECT * FROM reviews WHERE id=?").get(id) || null;
}

/* ------------------------------ Paiements -------------------------------- */
function createPayment(p) {
  const row = {
    id: uid("pay"), orderId: p.orderId || null, method: p.method || "", amount: Math.max(0, parseInt(p.amount, 10) || 0),
    phone: p.phone || "", reference: p.reference || "", instructions: p.instructions || "",
    status: p.status || "pending", createdAt: now(), updatedAt: now(),
  };
  db.prepare(`INSERT INTO payments (id,orderId,method,amount,phone,reference,instructions,status,createdAt,updatedAt)
    VALUES (@id,@orderId,@method,@amount,@phone,@reference,@instructions,@status,@createdAt,@updatedAt)`).run(row);
  if (row.orderId) setOrderPayment(row.orderId, row.method, row.status);
  return row;
}
function getPayment(id) { return db.prepare("SELECT * FROM payments WHERE id=?").get(id) || null; }
function paymentsForOrder(orderId) { return db.prepare("SELECT * FROM payments WHERE orderId=? ORDER BY createdAt DESC").all(orderId); }
function listPayments({ status } = {}) {
  let sql = "SELECT * FROM payments", args = {};
  if (status && status !== "all") { sql += " WHERE status=@status"; args.status = status; }
  return db.prepare(sql + " ORDER BY createdAt DESC LIMIT 500").all(args);
}
function setPaymentStatus(id, status) {
  const p = getPayment(id); if (!p) return null;
  db.prepare("UPDATE payments SET status=?,updatedAt=? WHERE id=?").run(status, now(), id);
  if (p.orderId) setOrderPayment(p.orderId, p.method, status);
  return getPayment(id);
}
// Répercute le statut de paiement sur la commande (payé → confirme la commande).
function setOrderPayment(orderId, method, paymentStatus) {
  const o = getOrder(orderId); if (!o) return;
  const patch = { paymentMethod: method || o.paymentMethod, paymentStatus, updatedAt: now() };
  // Un paiement encaissé confirme automatiquement la commande encore en attente.
  if (paymentStatus === "paid" && o.status === "pending") patch.status = "confirmed";
  db.prepare("UPDATE orders SET paymentMethod=?,paymentStatus=?,status=?,updatedAt=? WHERE id=?")
    .run(patch.paymentMethod, patch.paymentStatus, patch.status || o.status, patch.updatedAt, orderId);
}

/* ------------------------------ Boutiques -------------------------------- */
function upsertStore(ownerId, p) {
  if (!p || !p.name) return { error: "Nom de boutique requis." };
  const existing = p.id ? db.prepare("SELECT * FROM stores WHERE id=?").get(p.id)
                        : db.prepare("SELECT * FROM stores WHERE ownerId=?").get(ownerId);
  const s = {
    id: (existing && existing.id) || p.id || uid("sto"),
    ownerId: ownerId || (existing && existing.ownerId) || null,
    name: p.name, description: p.description || "", category: p.category || "",
    commune: p.commune || "", logo: p.logo || "",
    status: (existing && existing.status) || (p.approved ? "approved" : "pending"),
    createdAt: (existing && existing.createdAt) || now(), updatedAt: now(),
  };
  db.prepare(`INSERT INTO stores (id,ownerId,name,description,category,commune,logo,status,createdAt,updatedAt)
    VALUES (@id,@ownerId,@name,@description,@category,@commune,@logo,@status,@createdAt,@updatedAt)
    ON CONFLICT(id) DO UPDATE SET name=@name,description=@description,category=@category,commune=@commune,logo=@logo,updatedAt=@updatedAt`).run(s);
  return { store: s };
}
function getStoreById(id) { return db.prepare("SELECT * FROM stores WHERE id=?").get(id) || null; }
function getStoreByOwner(ownerId) { return db.prepare("SELECT * FROM stores WHERE ownerId=? ORDER BY createdAt DESC").get(ownerId) || null; }
function listStores({ status } = {}) {
  let sql = "SELECT * FROM stores", args = {};
  if (status && status !== "all") { sql += " WHERE status=@status"; args.status = status; }
  return db.prepare(sql + " ORDER BY createdAt DESC LIMIT 500").all(args);
}
function setStoreStatus(id, status) {
  if (!["pending", "approved", "suspended"].includes(status)) return null;
  db.prepare("UPDATE stores SET status=?,updatedAt=? WHERE id=?").run(status, now(), id);
  return getStoreById(id);
}
function vendorSales(storeId) {
  const s = db.prepare(`SELECT COUNT(DISTINCT oi.orderId) orders, COALESCE(SUM(oi.qty),0) units,
      COALESCE(SUM(oi.price*oi.qty),0) gross,
      COALESCE(SUM(CASE WHEN o.status IN('confirmed','shipped','delivered') THEN oi.price*oi.qty ELSE 0 END),0) revenue,
      COALESCE(SUM(CASE WHEN o.status='pending' THEN oi.price*oi.qty ELSE 0 END),0) pending
    FROM order_items oi JOIN orders o ON o.id=oi.orderId WHERE oi.storeId=?`).get(storeId);
  const lines = db.prepare(`SELECT oi.name,oi.price,oi.qty,oi.variant,o.id orderId,o.customerName,o.city,o.status,o.createdAt
    FROM order_items oi JOIN orders o ON o.id=oi.orderId WHERE oi.storeId=? ORDER BY o.createdAt DESC LIMIT 200`).all(storeId);
  return { summary: s, lines };
}

/* -------------------- Portefeuille & retraits vendeurs ------------------- */
function _storeGross(storeId, statuses) {
  const ph = statuses.map(() => "?").join(",");
  return db.prepare(`SELECT COALESCE(SUM(oi.price*oi.qty),0) g FROM order_items oi JOIN orders o ON o.id=oi.orderId
    WHERE oi.storeId=? AND o.status IN (${ph})`).get(storeId, ...statuses).g;
}
function _sumPayouts(storeId, statuses) {
  const ph = statuses.map(() => "?").join(",");
  return db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM payouts WHERE storeId=? AND status IN (${ph})`).get(storeId, ...statuses).s;
}
/** Portefeuille d'une boutique : escrow (en attente de livraison), disponible, retiré, commission. */
function vendorWallet(storeId) {
  const rate = COMMISSION_RATE;
  const deliveredGross = _storeGross(storeId, ["delivered"]);
  const escrowGross = _storeGross(storeId, ["confirmed", "shipped"]); // vendu, pas encore livré
  const deliveredNet = Math.round(deliveredGross * (1 - rate));
  const paidOut = _sumPayouts(storeId, ["paid"]);
  const held = _sumPayouts(storeId, ["requested"]); // retraits en cours (réservés)
  const available = Math.max(0, deliveredNet - paidOut - held);
  return {
    commissionRate: rate,
    escrow: Math.round(escrowGross * (1 - rate)),
    deliveredNet, available, paidOut, held,
    commission: Math.round(deliveredGross * rate),
    currency: "FCFA",
  };
}
function createPayout(storeId, { amount, method, details }) {
  const w = vendorWallet(storeId);
  const amt = Math.round(parseInt(amount, 10) || 0);
  if (amt <= 0) return { error: "Montant invalide." };
  if (amt > w.available) return { error: "Montant supérieur au solde disponible (" + w.available + " FCFA)." };
  const row = { id: uid("po"), storeId, amount: amt, method: method || "mobile", details: details || "", status: "requested", createdAt: now(), updatedAt: now() };
  db.prepare(`INSERT INTO payouts (id,storeId,amount,method,details,status,createdAt,updatedAt)
    VALUES (@id,@storeId,@amount,@method,@details,@status,@createdAt,@updatedAt)`).run(row);
  return { payout: row };
}
function listPayouts({ storeId, status } = {}) {
  let sql = "SELECT * FROM payouts WHERE 1=1", args = {};
  if (storeId) { sql += " AND storeId=@storeId"; args.storeId = storeId; }
  if (status && status !== "all") { sql += " AND status=@status"; args.status = status; }
  return db.prepare(sql + " ORDER BY createdAt DESC LIMIT 500").all(args);
}
function setPayoutStatus(id, status) {
  if (!["requested", "paid", "rejected"].includes(status)) return null;
  const p = db.prepare("SELECT * FROM payouts WHERE id=?").get(id);
  if (!p) return null;
  db.prepare("UPDATE payouts SET status=?,updatedAt=? WHERE id=?").run(status, now(), id);
  return db.prepare("SELECT * FROM payouts WHERE id=?").get(id);
}

/* -------------------- Réconciliation & journal comptable ----------------- */
// Journal unifié des mouvements financiers (paiements, remboursements, versements).
function transactions({ limit } = {}) {
  const lim = Math.min(parseInt(limit, 10) || 1000, 5000);
  const pays = db.prepare("SELECT p.*, o.customerName, o.note FROM payments p LEFT JOIN orders o ON o.id=p.orderId").all();
  const pos = db.prepare("SELECT po.*, s.name storeName FROM payouts po LEFT JOIN stores s ON s.id=po.storeId").all();
  const rows = [];
  for (const p of pays) {
    if (p.status === "cod") continue; // encaissement à la livraison, pas un flux en ligne
    const refunded = p.status === "refunded";
    rows.push({
      at: p.updatedAt || p.createdAt, kind: refunded ? "refund" : "payment",
      label: refunded ? "Remboursement" : "Paiement en ligne", ref: p.reference || p.id,
      party: p.customerName || "Client", method: p.method, amount: p.amount,
      direction: refunded ? "out" : "in", status: p.status,
    });
  }
  for (const po of pos) {
    rows.push({
      at: po.updatedAt || po.createdAt, kind: "payout", label: "Versement vendeur",
      ref: po.id, party: po.storeName || po.storeId, method: po.method, amount: po.amount,
      direction: "out", status: po.status,
    });
  }
  rows.sort((a, b) => b.at - a.at);
  return rows.slice(0, lim);
}
// Synthèse de réconciliation (soldes plateforme / vendeurs).
function reconciliation() {
  const rate = COMMISSION_RATE;
  let escrow = 0, available = 0, paidOut = 0, held = 0, commission = 0, deliveredNet = 0;
  for (const s of listStores({})) {
    const w = vendorWallet(s.id);
    escrow += w.escrow; available += w.available; paidOut += w.paidOut; held += w.held; commission += w.commission; deliveredNet += w.deliveredNet;
  }
  const onlinePaid = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status='paid'").get().s;
  const refunded = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status='refunded'").get().s;
  const codDelivered = db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status='delivered' AND paymentMethod='cod'").get().s;
  const dueToVendors = available + held; // net dû aux vendeurs, non encore versé
  return {
    commissionRate: rate,
    onlinePaid, refunded, codDelivered,
    commission, escrow, deliveredNet, paidOut, dueToVendors, available, held,
    // Contrôle : le net vendeur livré doit égaler (versé + à reverser).
    balanced: deliveredNet === paidOut + dueToVendors,
  };
}

/* ---------- Collections génériques (favoris, souhaits, coupons, …) -------- */
// Collections autorisées au mirroring (une par ligne, propre à chaque compte).
const SYNC_COLLECTIONS = ["favorites", "subs", "wishlists", "notifs", "messages", "coupons", "questions", "alerts", "stores", "expenses", "reports"];
function isSyncCollection(c) { return SYNC_COLLECTIONS.includes(c); }

function putDoc(userId, collection, data) {
  if (!userId || !isSyncCollection(collection)) return { error: "cible invalide" };
  db.prepare("INSERT INTO documents (collection,userId,data,updatedAt) VALUES (?,?,?,?) ON CONFLICT(collection,userId) DO UPDATE SET data=excluded.data,updatedAt=excluded.updatedAt")
    .run(collection, userId, JSON.stringify(data == null ? null : data), now());
  return { ok: true };
}
function getDoc(userId, collection) {
  const r = db.prepare("SELECT data FROM documents WHERE collection=? AND userId=?").get(collection, userId);
  if (!r) return null;
  try { return JSON.parse(r.data); } catch (e) { return null; }
}
function getAllDocs(userId) {
  const out = {};
  for (const r of db.prepare("SELECT collection,data FROM documents WHERE userId=?").all(userId)) {
    try { out[r.collection] = JSON.parse(r.data); } catch (e) {}
  }
  return out;
}
function listCollections() {
  return db.prepare("SELECT collection, COUNT(*) accounts, COALESCE(SUM(LENGTH(data)),0) bytes, MAX(updatedAt) updatedAt FROM documents GROUP BY collection ORDER BY collection").all();
}
function listDocs(collection) {
  return db.prepare("SELECT userId, LENGTH(data) bytes, updatedAt FROM documents WHERE collection=? ORDER BY updatedAt DESC").all(collection);
}

module.exports = {
  init, available, uid, isSyncCollection, SYNC_COLLECTIONS,
  putDoc, getDoc, getAllDocs, listCollections, listDocs,
  createUser, authUser, getUser, publicUser,
  createSession, userIdForToken, destroySession,
  upsertProduct, listProducts, getProduct, countProducts,
  getCart, setCart,
  createOrder, getOrder, listOrders, setOrderStatus, refundOrder, stats,
  addReview, listReviews, ratingFor, setReviewStatus,
  upsertStore, getStoreById, getStoreByOwner, listStores, setStoreStatus, vendorSales,
  createPayment, getPayment, paymentsForOrder, listPayments, setPaymentStatus,
  vendorWallet, createPayout, listPayouts, setPayoutStatus, COMMISSION_RATE,
  transactions, reconciliation,
};
