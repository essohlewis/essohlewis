<?php

declare(strict_types=1);

namespace Transouscris\Core;

/**
 * Limiteur de débit à fenêtre glissante, persisté en base (table rate_limits).
 * Utilisé sur les endpoints OTP et paiement. Clé = action + identifiant
 * (IP ou téléphone). Résistant au redémarrage process (contrairement à APCu).
 */
final class RateLimiter
{
    /**
     * Tente de consommer un jeton. Retourne true si autorisé, false si bloqué.
     *
     * @param string $key       identifiant logique (ex: "otp:2250700000000")
     * @param int    $maxHits   nombre max d'actions sur la fenêtre
     * @param int    $window    fenêtre en secondes
     */
    public static function attempt(string $key, int $maxHits, int $window): bool
    {
        $pdo = Database::connection();
        $now = time();
        $bucketStart = $now - $window;

        return Database::transaction(function ($pdo) use ($key, $maxHits, $window, $now, $bucketStart) {
            // Verrou pessimiste sur la ligne du compteur.
            $stmt = $pdo->prepare(
                'SELECT id, hits, window_start FROM rate_limits WHERE rate_key = :k FOR UPDATE'
            );
            $stmt->execute(['k' => $key]);
            $row = $stmt->fetch();

            if ($row === false) {
                $pdo->prepare(
                    'INSERT INTO rate_limits (rate_key, hits, window_start) VALUES (:k, 1, :now)'
                )->execute(['k' => $key, 'now' => $now]);
                return true;
            }

            // Fenêtre expirée → réinitialisation.
            if ((int) $row['window_start'] < $bucketStart) {
                $pdo->prepare(
                    'UPDATE rate_limits SET hits = 1, window_start = :now WHERE id = :id'
                )->execute(['now' => $now, 'id' => $row['id']]);
                return true;
            }

            if ((int) $row['hits'] >= $maxHits) {
                return false;
            }

            $pdo->prepare('UPDATE rate_limits SET hits = hits + 1 WHERE id = :id')
                ->execute(['id' => $row['id']]);
            return true;
        });
    }

    public static function clear(string $key): void
    {
        Database::connection()
            ->prepare('DELETE FROM rate_limits WHERE rate_key = :k')
            ->execute(['k' => $key]);
    }
}
