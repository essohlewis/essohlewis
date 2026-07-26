<?php
declare(strict_types=1);

namespace Amoura\Core;

use PDO;
use PDOException;

/**
 * Singleton PDO. Toutes les requêtes de l'application passent par cette
 * connexion unique. Requêtes préparées uniquement (voir Model).
 */
final class Database
{
    private static ?PDO $instance = null;

    private function __construct() {}

    public static function connection(): PDO
    {
        if (self::$instance instanceof PDO) {
            return self::$instance;
        }

        $host    = (string) Env::get('DB_HOST', '127.0.0.1');
        $port    = (string) Env::get('DB_PORT', '3306');
        $name    = (string) Env::get('DB_NAME', 'amoura');
        $charset = (string) Env::get('DB_CHARSET', 'utf8mb4');

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";

        try {
            self::$instance = new PDO(
                $dsn,
                (string) Env::get('DB_USER', 'root'),
                (string) Env::get('DB_PASS', ''),
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    // false => vraies requêtes préparées côté serveur (anti-injection robuste).
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::ATTR_STRINGIFY_FETCHES  => false,
                ]
            );
        } catch (PDOException $e) {
            // Ne jamais divulguer les identifiants dans le message d'erreur.
            if (Env::bool('APP_DEBUG')) {
                throw $e;
            }
            http_response_code(500);
            exit('Erreur de connexion à la base de données.');
        }

        return self::$instance;
    }

    /** Injection d'une connexion (tests). */
    public static function setConnection(PDO $pdo): void
    {
        self::$instance = $pdo;
    }
}
