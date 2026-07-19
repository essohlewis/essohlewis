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
      status TEXT DEFAULT 'pending', note TEXT, createdAt INTEGER, updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, orderId TEXT, productId TEXT,
      name TEXT, price INTEGER, qty INTEGER, variant TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, userId TEXT, createdAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userId);
    CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(orderId);
    CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category);
  `);
  // Migrations légères pour les bases créées avant l'ajout de ces colonnes.
  for (const col of ["itemsTotal INTEGER DEFAULT 0", "deliveryFee INTEGER DEFAULT 0", "discount INTEGER DEFAULT 0"]) {
    try { db.exec(`ALTER TABLE orders ADD COLUMN ${col}`); } catch (e) { /* colonne déjà présente */ }
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
function getProduct(id) { return db.prepare("SELECT * FROM products WHERE id=?").get(id) || null; }
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
    const prod = getProduct(it.productId);
    const price = prod ? prod.price : Math.max(0, parseInt(it.price, 10) || 0);
    const name = prod ? prod.name : (it.name || "Article");
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    itemsTotal += price * qty;
    resolved.push({ productId: it.productId || "", name, price, qty, variant: it.variant || "" });
  }
  const deliveryFee = Math.max(0, parseInt(payload.deliveryFee, 10) || 0);
  const discount = Math.max(0, parseInt(payload.discount, 10) || 0);
  const total = Math.max(0, itemsTotal - discount) + deliveryFee;
  const o = {
    id: uid("cmd"), userId: userId || null,
    customerName: payload.customerName || "", phone: payload.phone || "", address: payload.address || "",
    city: payload.city || "", itemsTotal, deliveryFee, discount, total, currency: "FCFA", payment: payload.payment || "cod",
    status: "pending", note: payload.note || "", createdAt: now(), updatedAt: now(),
  };
  const insertOrder = db.prepare(`INSERT INTO orders (id,userId,customerName,phone,address,city,itemsTotal,deliveryFee,discount,total,currency,payment,status,note,createdAt,updatedAt)
    VALUES (@id,@userId,@customerName,@phone,@address,@city,@itemsTotal,@deliveryFee,@discount,@total,@currency,@payment,@status,@note,@createdAt,@updatedAt)`);
  const insertItem = db.prepare("INSERT INTO order_items (orderId,productId,name,price,qty,variant) VALUES (?,?,?,?,?,?)");
  const decStock = db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id=? AND stock > 0");
  // node:sqlite n'a pas de helper transaction() → BEGIN/COMMIT manuels.
  db.exec("BEGIN");
  try {
    insertOrder.run(o);
    for (const r of resolved) { insertItem.run(o.id, r.productId, r.name, r.price, r.qty, r.variant); if (r.productId) decStock.run(r.qty, r.productId); }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); return { error: "Échec de l'enregistrement de la commande." }; }
  if (userId) setCart(userId, []); // vide le panier après achat
  return { order: getOrder(o.id) };
}
function getOrder(id) {
  const o = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!o) return null;
  o.items = db.prepare("SELECT productId,name,price,qty,variant FROM order_items WHERE orderId=?").all(id);
  return o;
}
function listOrders({ userId, status, limit } = {}) {
  let sql = "SELECT * FROM orders WHERE 1=1", args = {};
  if (userId) { sql += " AND userId=@userId"; args.userId = userId; }
  if (status && status !== "all") { sql += " AND status=@status"; args.status = status; }
  sql += " ORDER BY createdAt DESC LIMIT @limit"; args.limit = Math.min(parseInt(limit, 10) || 200, 1000);
  const rows = db.prepare(sql).all(args);
  const itemsStmt = db.prepare("SELECT productId,name,price,qty,variant FROM order_items WHERE orderId=?");
  for (const r of rows) r.items = itemsStmt.all(r.id);
  return rows;
}
function setOrderStatus(id, status) {
  const ok = ["pending", "confirmed", "shipped", "delivered", "cancelled"].includes(status);
  if (!ok) return null;
  db.prepare("UPDATE orders SET status=?,updatedAt=? WHERE id=?").run(status, now(), id);
  return getOrder(id);
}
function stats() {
  return {
    users: db.prepare("SELECT COUNT(*) c FROM users").get().c,
    products: countProducts(),
    orders: db.prepare("SELECT COUNT(*) c FROM orders").get().c,
    revenue: db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN ('confirmed','shipped','delivered')").get().s,
  };
}

module.exports = {
  init, available, uid,
  createUser, authUser, getUser, publicUser,
  createSession, userIdForToken, destroySession,
  upsertProduct, listProducts, getProduct, countProducts,
  getCart, setCart,
  createOrder, getOrder, listOrders, setOrderStatus, stats,
};
