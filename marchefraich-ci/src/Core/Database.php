<?php
/**
 * Connexion MySQL via PDO (singleton).
 *
 * Fournit un accès partagé à la base pour tous les modèles.
 * Erreurs en exceptions, fetch en tableau associatif, requêtes préparées
 * (protection contre les injections SQL).
 */

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

class Database
{
    private static ?PDO $pdo = null;

    /**
     * Retourne l'instance PDO partagée, créée à la première demande.
     *
     * @param array<string,mixed> $config Section 'db' de la configuration
     */
    public static function connexion(array $config): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['name'],
            $config['charset']
        );

        try {
            self::$pdo = new PDO($dsn, $config['user'], $config['pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException(
                'Connexion à la base de données impossible : ' . $e->getMessage()
            );
        }

        return self::$pdo;
    }

    /**
     * Retourne la connexion déjà établie (après bootstrap).
     */
    public static function pdo(): PDO
    {
        if (!self::$pdo instanceof PDO) {
            throw new RuntimeException('La base de données n\'est pas initialisée.');
        }
        return self::$pdo;
    }

    /**
     * Permet d'injecter une connexion (tests) ou de réinitialiser.
     */
    public static function definir(?PDO $pdo): void
    {
        self::$pdo = $pdo;
    }
}
