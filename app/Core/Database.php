<?php

declare(strict_types=1);

namespace Transouscris\Core;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Connexion PDO MySQL unique (singleton) + helpers de transaction.
 *
 * La méthode transaction() encapsule BEGIN/COMMIT/ROLLBACK et garantit qu'un
 * échec relève l'exception après rollback — indispensable pour l'intégrité du
 * grand livre en partie double.
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $cfg = Config::get('db');
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $cfg['host'],
            $cfg['port'],
            $cfg['name'],
            $cfg['charset']
        );

        try {
            self::$pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_STRINGIFY_FETCHES  => false,
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException('Connexion base de données impossible.', 0, $e);
        }

        return self::$pdo;
    }

    /**
     * Exécute un callback dans une transaction. Le callback reçoit le PDO.
     * En cas d'exception, la transaction est annulée et l'exception relevée.
     *
     * @template T
     * @param callable(PDO):T $callback
     * @return T
     */
    public static function transaction(callable $callback): mixed
    {
        $pdo = self::connection();

        // Empêche les transactions imbriquées silencieuses.
        if ($pdo->inTransaction()) {
            return $callback($pdo);
        }

        $pdo->beginTransaction();
        try {
            $result = $callback($pdo);
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /** Réinitialise la connexion (utile en tests). */
    public static function reset(): void
    {
        self::$pdo = null;
    }

    public static function setConnection(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }
}
