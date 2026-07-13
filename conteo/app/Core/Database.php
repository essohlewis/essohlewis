<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Connexion PDO singleton vers MySQL.
 * Toutes les requêtes de l'application passent par cette instance,
 * exclusivement en requêtes préparées (cf. App\Core\Model).
 */
final class Database
{
    private static ?PDO $instance = null;

    private function __construct()
    {
    }

    public static function connection(): PDO
    {
        if (self::$instance instanceof PDO) {
            return self::$instance;
        }

        /** @var array<string,mixed> $config */
        $config = require dirname(__DIR__, 2) . '/config/config.php';
        $db = $config['db'];

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $db['host'],
            $db['port'],
            $db['name'],
            $db['charset']
        );

        try {
            self::$instance = new PDO($dsn, $db['user'], $db['pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_STRINGIFY_FETCHES  => false,
            ]);
        } catch (PDOException $e) {
            // Ne jamais exposer les détails de connexion au client.
            throw new RuntimeException('Database connection failed.', 0, $e);
        }

        return self::$instance;
    }

    /** Réinitialise la connexion (tests). */
    public static function reset(): void
    {
        self::$instance = null;
    }
}
