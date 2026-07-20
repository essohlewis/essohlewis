/**
 * migrations.js — Système de migrations versionnées (remplace les ALTER ad hoc).
 *
 * Chaque migration a un numéro de version et une fonction `up(db)`. Le runner
 * applique, dans l'ordre et une seule fois, les migrations non encore
 * enregistrées dans la table `schema_migrations`. Reproductible sur toute base.
 */
"use strict";

/** Ajoute une colonne si elle n'existe pas encore (idempotent). */
function addColumn(db, table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}

const MIGRATIONS = [
  {
    version: 1,
    name: "schema-initial",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, phone TEXT,
          passHash TEXT, passSalt TEXT, role TEXT DEFAULT 'client', createdAt INTEGER,
          emailVerified INTEGER DEFAULT 0, phoneVerified INTEGER DEFAULT 0,
          twofaSecret TEXT, twofaEnabled INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS otp (
          id TEXT PRIMARY KEY, kind TEXT, subject TEXT, userId TEXT, code TEXT, expiresAt INTEGER, createdAt INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp(kind, subject);
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY, storeId TEXT, storeName TEXT, name TEXT, description TEXT,
          price INTEGER, currency TEXT DEFAULT 'FCFA', category TEXT, image TEXT,
          stock INTEGER DEFAULT 0, active INTEGER DEFAULT 1, createdAt INTEGER
        );
        CREATE TABLE IF NOT EXISTS carts (userId TEXT PRIMARY KEY, items TEXT, updatedAt INTEGER);
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
          token TEXT PRIMARY KEY, userId TEXT, createdAt INTEGER,
          expiresAt INTEGER, refreshToken TEXT, refreshExpiresAt INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions(refreshToken);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
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
    },
  },
  {
    // Rattrape les colonnes ajoutées historiquement sur des bases antérieures.
    version: 2,
    name: "colonnes-additionnelles",
    up(db) {
      for (const c of ["itemsTotal INTEGER DEFAULT 0", "deliveryFee INTEGER DEFAULT 0", "discount INTEGER DEFAULT 0",
                        "paymentMethod TEXT DEFAULT 'cod'", "paymentStatus TEXT DEFAULT 'cod'"]) {
        const [name, ...def] = c.split(" ");
        addColumn(db, "orders", name, def.join(" "));
      }
      for (const c of [["order_items", "storeId TEXT"], ["order_items", "storeName TEXT"],
                       ["sessions", "expiresAt INTEGER"], ["sessions", "refreshToken TEXT"], ["sessions", "refreshExpiresAt INTEGER"],
                       ["users", "emailVerified INTEGER DEFAULT 0"], ["users", "phoneVerified INTEGER DEFAULT 0"],
                       ["users", "twofaSecret TEXT"], ["users", "twofaEnabled INTEGER DEFAULT 0"]]) {
        const [name, ...def] = c[1].split(" ");
        addColumn(db, c[0], name, def.join(" "));
      }
    },
  },
  {
    version: 3,
    name: "abonnements-push",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS push_subs (
          endpoint TEXT PRIMARY KEY, userId TEXT, p256dh TEXT, auth TEXT, createdAt INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_push_user ON push_subs(userId);
      `);
    },
  },
  {
    version: 4,
    name: "fidelite-points",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS loyalty_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, delta INTEGER,
          reason TEXT, orderId TEXT, createdAt INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_ledger(userId);
        CREATE INDEX IF NOT EXISTS idx_loyalty_order ON loyalty_ledger(orderId, reason);
      `);
    },
  },
  {
    version: 5,
    name: "questions-produit",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS product_questions (
          id TEXT PRIMARY KEY, productId TEXT, storeId TEXT, userId TEXT, authorName TEXT,
          question TEXT, answer TEXT, answeredAt INTEGER, status TEXT DEFAULT 'visible', createdAt INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_pq_product ON product_questions(productId, status);
        CREATE INDEX IF NOT EXISTS idx_pq_store ON product_questions(storeId);
      `);
    },
  },
];

function currentVersion(db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT, appliedAt INTEGER)");
  const r = db.prepare("SELECT MAX(version) v FROM schema_migrations").get();
  return (r && r.v) || 0;
}

/** Applique les migrations manquantes. Renvoie { from, to, applied:[versions] }. */
function run(db) {
  const from = currentVersion(db);
  const applied = [];
  const record = db.prepare("INSERT INTO schema_migrations (version,name,appliedAt) VALUES (?,?,?)");
  for (const m of MIGRATIONS) {
    if (m.version <= from) continue;
    db.exec("BEGIN");
    try { m.up(db); record.run(m.version, m.name, Date.now()); db.exec("COMMIT"); applied.push(m.version); }
    catch (e) { db.exec("ROLLBACK"); throw e; }
  }
  return { from, to: MIGRATIONS[MIGRATIONS.length - 1].version, applied };
}

module.exports = { run, currentVersion, MIGRATIONS };
