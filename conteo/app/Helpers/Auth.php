<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Core\Database;
use App\Core\Request;

/**
 * Authentification stateless par Bearer token.
 *
 * Le client reçoit un token opaque à la connexion ; seul le SHA-256 du token
 * est stocké (table api_tokens). À chaque requête, on re-hache le token fourni
 * et on recherche le hash.
 */
final class Auth
{
    /** @var array<string,mixed>|null */
    private static ?array $currentUser = null;

    /**
     * Vérifie le Bearer token et charge l'utilisateur. Renvoie l'utilisateur
     * ou null. Met en cache l'utilisateur courant pour la requête.
     *
     * @return array<string,mixed>|null
     */
    public static function authenticate(Request $request): ?array
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        $hash = hash('sha256', $token);
        $db = Database::connection();

        $stmt = $db->prepare(
            'SELECT u.* FROM api_tokens t
             JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = ?
               AND t.revoked_at IS NULL
               AND t.expires_at > NOW()
               AND u.status = "active"
             LIMIT 1'
        );
        $stmt->execute([$hash]);
        $user = $stmt->fetch();
        if (!$user) {
            return null;
        }

        self::$currentUser = $user;
        return $user;
    }

    /** @return array<string,mixed>|null */
    public static function currentUser(): ?array
    {
        return self::$currentUser;
    }

    /**
     * Émet un nouveau token pour l'utilisateur. Renvoie le token en clair
     * (à ne renvoyer qu'une fois au client).
     */
    public static function issueToken(int $userId, ?string $deviceLabel = null): string
    {
        $config = require dirname(__DIR__, 2) . '/config/config.php';
        $ttlDays = (int) $config['security']['token_ttl_days'];

        $token = bin2hex(random_bytes(32)); // 64 hex chars
        $hash = hash('sha256', $token);
        $expires = (new \DateTimeImmutable("+{$ttlDays} days"))->format('Y-m-d H:i:s');

        $db = Database::connection();
        $stmt = $db->prepare(
            'INSERT INTO api_tokens (user_id, token_hash, device_label, expires_at)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $hash, $deviceLabel, $expires]);

        return $token;
    }

    /** Révoque le token courant (logout). */
    public static function revoke(string $token): void
    {
        $hash = hash('sha256', $token);
        $db = Database::connection();
        $stmt = $db->prepare('UPDATE api_tokens SET revoked_at = NOW() WHERE token_hash = ?');
        $stmt->execute([$hash]);
    }

    public static function hashPassword(string $plain): string
    {
        return password_hash($plain, PASSWORD_ARGON2ID);
    }

    public static function verifyPassword(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    /** Réinitialisation pour les tests. */
    public static function reset(): void
    {
        self::$currentUser = null;
    }
}
