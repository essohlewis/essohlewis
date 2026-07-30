<?php
declare(strict_types=1);

/**
 * Db — connexion PDO + schéma (migrations idempotentes) + amorçage.
 *
 * PDO uniquement (aucun framework). Par défaut SQLite (fichier), mais le DSN
 * est configurable (DB_DSN) pour basculer vers MySQL/PostgreSQL en production
 * sans changer le code métier — c'est tout l'intérêt de PDO.
 */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }
        $dsn  = getenv('DB_DSN') ?: '';
        $user = getenv('DB_USER') ?: null;
        $pass = getenv('DB_PASS') ?: null;

        if ($dsn === '') {
            $dir = getenv('SHOP_DATA_DIR') ?: (__DIR__ . '/../data');
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            $file = getenv('SHOP_DB') ?: ($dir . '/marche.db');
            $dsn = 'sqlite:' . $file;
        }

        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        if (str_starts_with($dsn, 'sqlite:')) {
            $pdo->exec('PRAGMA journal_mode = WAL');
            $pdo->exec('PRAGMA foreign_keys = ON');
        }
        self::$pdo = $pdo;
        self::migrate($pdo);
        return $pdo;
    }

    /** Type auto-incrément portable (SQLite vs MySQL/PostgreSQL). */
    private static function autoPk(PDO $pdo): string
    {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        return match ($driver) {
            'mysql'  => 'INTEGER PRIMARY KEY AUTO_INCREMENT',
            'pgsql'  => 'SERIAL PRIMARY KEY',
            default  => 'INTEGER PRIMARY KEY AUTOINCREMENT',
        };
    }

    /** Crée les tables si absentes (idempotent). */
    public static function migrate(PDO $pdo): void
    {
        $pk = self::autoPk($pdo);
        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, phone TEXT,
            passHash TEXT, role TEXT DEFAULT 'client', emailVerified INTEGER DEFAULT 0,
            createdAt INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY, userId TEXT, createdAt INTEGER, expiresAt INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY, storeId TEXT, storeName TEXT, name TEXT, description TEXT,
            price INTEGER, currency TEXT DEFAULT 'FCFA', category TEXT, image TEXT,
            stock INTEGER DEFAULT 0, active INTEGER DEFAULT 1, createdAt INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY, label TEXT, icon TEXT, parentId TEXT,
            sortOrder INTEGER DEFAULT 0, active INTEGER DEFAULT 1, createdAt INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS carts (userId TEXT PRIMARY KEY, items TEXT, updatedAt INTEGER)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY, userId TEXT, customerName TEXT, phone TEXT, address TEXT,
            city TEXT, itemsTotal INTEGER DEFAULT 0, deliveryFee INTEGER DEFAULT 0, discount INTEGER DEFAULT 0,
            total INTEGER, currency TEXT DEFAULT 'FCFA', paymentMethod TEXT DEFAULT 'cod',
            status TEXT DEFAULT 'pending', note TEXT, createdAt INTEGER, updatedAt INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (
            id $pk, orderId TEXT, productId TEXT, name TEXT, price INTEGER, qty INTEGER,
            variant TEXT, storeId TEXT, storeName TEXT
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY, targetType TEXT, targetId TEXT, userId TEXT,
            authorName TEXT, rating INTEGER, comment TEXT, verified INTEGER DEFAULT 0,
            status TEXT DEFAULT 'visible', createdAt INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS documents (
            collection TEXT, userId TEXT, data TEXT, updatedAt INTEGER,
            PRIMARY KEY (collection, userId)
        )");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userId)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(orderId)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(targetType, targetId)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category)");
    }
}
