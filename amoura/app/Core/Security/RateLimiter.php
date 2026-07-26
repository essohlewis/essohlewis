<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

use Amoura\Core\Database;

/**
 * Limiteur de débit persistant (table rate_limits).
 * Fenêtre glissante simple par « bucket » (ex: login:IP, otp:email).
 */
final class RateLimiter
{
    /**
     * @return bool true si l'action est autorisée, false si le quota est dépassé.
     */
    public static function attempt(string $bucket, int $maxAttempts, int $windowSeconds = 60): bool
    {
        $db = Database::connection();
        $now = time();

        return $db->beginTransaction() ? (function () use ($db, $bucket, $maxAttempts, $windowSeconds, $now) {
            try {
                // Verrouillage de la ligne pour éviter les conditions de course.
                $stmt = $db->prepare('SELECT hits, reset_at FROM rate_limits WHERE bucket = ? FOR UPDATE');
                $stmt->execute([$bucket]);
                $row = $stmt->fetch();

                if ($row === false || (int) $row['reset_at'] <= $now) {
                    $db->prepare(
                        'INSERT INTO rate_limits (bucket, hits, reset_at) VALUES (?, 1, ?)
                         ON DUPLICATE KEY UPDATE hits = 1, reset_at = VALUES(reset_at)'
                    )->execute([$bucket, $now + $windowSeconds]);
                    $db->commit();
                    return true;
                }

                if ((int) $row['hits'] >= $maxAttempts) {
                    $db->commit();
                    return false;
                }

                $db->prepare('UPDATE rate_limits SET hits = hits + 1 WHERE bucket = ?')->execute([$bucket]);
                $db->commit();
                return true;
            } catch (\Throwable $e) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                // En cas d'échec du backend, on n'ouvre pas la porte : refus prudent.
                return false;
            }
        })() : true;
    }

    public static function secondsUntilReset(string $bucket): int
    {
        $stmt = Database::connection()->prepare('SELECT reset_at FROM rate_limits WHERE bucket = ?');
        $stmt->execute([$bucket]);
        $row = $stmt->fetch();
        return $row ? max(0, (int) $row['reset_at'] - time()) : 0;
    }

    public static function clear(string $bucket): void
    {
        Database::connection()->prepare('DELETE FROM rate_limits WHERE bucket = ?')->execute([$bucket]);
    }
}
