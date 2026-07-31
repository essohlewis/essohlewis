<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Connexion à la base de données via PDO (patron Singleton).
 *
 * Une seule instance de connexion PDO est partagée pour toute la durée
 * de la requête HTTP. Toutes les requêtes passent par des requêtes
 * préparées afin de prévenir toute injection SQL.
 */
final class Database
{
    /** Instance PDO unique. */
    private static ?PDO $instance = null;

    /** Empêche l'instanciation directe. */
    private function __construct()
    {
    }

    /**
     * Retourne l'instance PDO partagée, en la créant au premier appel.
     */
    public static function connection(): PDO
    {
        if (self::$instance instanceof PDO) {
            return self::$instance;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST,
            DB_PORT,
            DB_NAME,
            DB_CHARSET
        );

        // Options PDO : exceptions, fetch associatif, requêtes réellement
        // préparées côté serveur (pas d'émulation).
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_STRINGIFY_FETCHES  => false,
        ];

        try {
            self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // On ne divulgue jamais le détail de l'erreur à l'utilisateur.
            if (APP_ENV === 'dev') {
                throw new RuntimeException('Connexion BDD échouée : ' . $e->getMessage());
            }
            throw new RuntimeException('Service temporairement indisponible.');
        }

        return self::$instance;
    }
}
