<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Core\Database;

/**
 * Rate limiting persistant (table rate_limits), à fenêtre fixe.
 * Sans dépendance externe (pas de Redis requis).
 */
final class RateLimit
{
    /**
     * Enregistre une tentative pour la clé donnée. Renvoie true si la limite
     * est dépassée (la requête doit être rejetée).
     */
    public static function tooMany(string $key, int $max, int $windowSec): bool
    {
        $db = Database::connection();
        $now = time();
        $bucket = substr($key, 0, 160);

        $stmt = $db->prepare('SELECT hits, window_start FROM rate_limits WHERE bucket_key = ? LIMIT 1');
        $stmt->execute([$bucket]);
        $row = $stmt->fetch();

        if (!$row) {
            $ins = $db->prepare('INSERT INTO rate_limits (bucket_key, hits, window_start) VALUES (?, 1, ?)');
            $ins->execute([$bucket, $now]);
            return false;
        }

        // Fenêtre expirée : on réinitialise.
        if ($now - (int) $row['window_start'] >= $windowSec) {
            $upd = $db->prepare('UPDATE rate_limits SET hits = 1, window_start = ? WHERE bucket_key = ?');
            $upd->execute([$now, $bucket]);
            return false;
        }

        if ((int) $row['hits'] >= $max) {
            return true;
        }

        $upd = $db->prepare('UPDATE rate_limits SET hits = hits + 1 WHERE bucket_key = ?');
        $upd->execute([$bucket]);
        return false;
    }
}
