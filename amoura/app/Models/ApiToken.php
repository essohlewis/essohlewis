<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Jetons d'accès API (porteurs opaques) pour l'authentification stateless des
 * clients mobiles/tiers. Le jeton en clair (préfixe `amoura_` + 64 hex) n'est
 * révélé qu'à l'émission ; seule son empreinte SHA-256 est stockée. Résolution,
 * expiration, portées (abilities) et révocation sont gérées ici.
 */
final class ApiToken extends Model
{
    protected string $table = 'api_tokens';

    /** Préfixe lisible pour repérer un jeton Amoura dans les journaux/fuites. */
    public const PREFIX = 'amoura_';

    /** Empreinte de stockage d'un jeton en clair (SHA-256 hex, comparaison par hash). */
    public static function hashToken(string $plain): string
    {
        return hash('sha256', $plain);
    }

    /**
     * Émet un nouveau jeton pour un utilisateur.
     *
     * @param string[] $abilities portées accordées (par défaut « tout »).
     * @return array{token:string,id:int,expires_at:?string} le jeton EN CLAIR (non re-affichable).
     */
    public function issue(int $userId, string $name = 'mobile', array $abilities = ['*'], ?int $ttlSeconds = null): array
    {
        $plain = self::PREFIX . bin2hex(random_bytes(32));
        $expiresAt = $ttlSeconds !== null ? date('Y-m-d H:i:s', time() + $ttlSeconds) : null;

        $id = $this->create([
            'user_id'    => $userId,
            'name'       => mb_substr($name, 0, 100),
            'token_hash' => self::hashToken($plain),
            'abilities'  => json_encode(array_values($abilities), JSON_UNESCAPED_SLASHES),
            'expires_at' => $expiresAt,
        ]);

        return ['token' => $plain, 'id' => $id, 'expires_at' => $expiresAt];
    }

    /**
     * Résout un jeton en clair vers sa ligne, si valide (existant + non expiré).
     * Met à jour `last_used_at` (au plus une fois par minute pour éviter une
     * écriture à chaque requête). Retourne null si invalide/expiré.
     *
     * @return array<string,mixed>|null
     */
    public function resolve(string $plain): ?array
    {
        if ($plain === '') {
            return null;
        }
        $row = $this->run(
            'SELECT * FROM api_tokens WHERE token_hash = ? LIMIT 1',
            [self::hashToken($plain)]
        )->fetch();
        if (!$row) {
            return null;
        }
        if ($row['expires_at'] !== null && strtotime((string) $row['expires_at']) < time()) {
            return null;
        }
        // Trace d'usage throttlée.
        $last = $row['last_used_at'] !== null ? strtotime((string) $row['last_used_at']) : 0;
        if (time() - $last >= 60) {
            $this->run('UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?', [$row['id']]);
        }
        return $row;
    }

    /** Portées accordées à une ligne de jeton (tableau, tolérant au JSON absent/malformé). */
    public static function abilitiesOf(array $token): array
    {
        $raw = $token['abilities'] ?? null;
        if (is_array($raw)) {
            return $raw;
        }
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Un jeu de portées autorise-t-il l'action demandée ?
     *  - « * »          : tout permis (super-jeton) ;
     *  - « ns:* »       : joker de préfixe (ex. « messages:* » couvre « messages:write ») ;
     *  - correspondance exacte sinon.
     *
     * @param string[] $abilities
     */
    public static function allows(array $abilities, string $ability): bool
    {
        foreach ($abilities as $granted) {
            if ($granted === '*' || $granted === $ability) {
                return true;
            }
            if (str_ends_with((string) $granted, ':*')
                && str_starts_with($ability, substr((string) $granted, 0, -1))) {
                return true;
            }
        }
        return false;
    }

    /** Liste des jetons actifs d'un utilisateur (sans l'empreinte). @return array<int,array<string,mixed>> */
    public function forUser(int $userId): array
    {
        return $this->run(
            'SELECT id, name, abilities, last_used_at, expires_at, created_at
             FROM api_tokens WHERE user_id = ? ORDER BY id DESC',
            [$userId]
        )->fetchAll();
    }

    /** Révoque un jeton précis, borné à son propriétaire. */
    public function revoke(int $id, int $userId): bool
    {
        return $this->run(
            'DELETE FROM api_tokens WHERE id = ? AND user_id = ?',
            [$id, $userId]
        )->rowCount() > 0;
    }

    /** Révoque tous les jetons d'un utilisateur (« déconnecter tous les appareils »). */
    public function revokeAll(int $userId): int
    {
        return $this->run('DELETE FROM api_tokens WHERE user_id = ?', [$userId])->rowCount();
    }

    /** Purge des jetons expirés (appelée par le cron de maintenance). */
    public function purgeExpired(): int
    {
        return $this->run(
            'DELETE FROM api_tokens WHERE expires_at IS NOT NULL AND expires_at < NOW()'
        )->rowCount();
    }
}
