<?php
/* ==========================================================================
   core/Database.php — Connexion PDO (singleton), MySQL ou SQLite.
   Toutes les requêtes utilisent des requêtes préparées (anti-injection SQL).
   ========================================================================== */

class Database
{
    private static ?PDO $instance = null;

    public static function connexion(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $cfg = App::config('db');
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        if (($cfg['driver'] ?? 'mysql') === 'sqlite') {
            $pdo = new PDO('sqlite:' . $cfg['sqlite_path'], null, null, $options);
            $pdo->exec('PRAGMA foreign_keys = ON');
        } else {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $cfg['host'], $cfg['port'], $cfg['name'], $cfg['charset']
            );
            $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], $options);
        }

        self::$instance = $pdo;
        return $pdo;
    }

    /** Détecte le pilote actif (utile pour de rares différences SQL). */
    public static function pilote(): string
    {
        return App::config('db')['driver'] ?? 'mysql';
    }
}
