<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

use Amoura\Core\Database;
use Amoura\Core\Session;

/**
 * Authentification & autorisation.
 * - Hachage Argon2id des mots de passe.
 * - État de connexion en session (id utilisateur uniquement).
 * - Vérification de permissions basée sur les rôles (RBAC).
 */
final class Auth
{
    private const SESSION_KEY = 'user_id';
    private static ?array $cache = null;

    /** Options Argon2id — coût mémoire/temps raisonnable pour un serveur web. */
    private static function hashOptions(): array
    {
        return [
            'memory_cost' => 1 << 16, // 64 Mo
            'time_cost'   => 4,
            'threads'     => 1,
        ];
    }

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID, self::hashOptions());
    }

    public static function verify(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    public static function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_ARGON2ID, self::hashOptions());
    }

    /** Établit la session pour l'utilisateur donné (après vérification du mot de passe). */
    public static function login(int $userId): void
    {
        Session::regenerate();
        Session::put(self::SESSION_KEY, $userId);
        Session::put('_auth_time', time());   // horodatage pour la révocation de sessions
        self::$cache = null;
    }

    public static function logout(): void
    {
        Session::forget(self::SESSION_KEY);
        self::$cache = null;
    }

    public static function id(): ?int
    {
        $id = Session::get(self::SESSION_KEY);
        return is_int($id) ? $id : (is_numeric($id) ? (int) $id : null);
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    /** Charge l'utilisateur courant (avec rôle + permissions), mis en cache par requête. */
    public static function user(): ?array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        $id = self::id();
        if ($id === null) {
            return null;
        }
        $stmt = Database::connection()->prepare(
            'SELECT u.*, r.slug AS role_slug, r.permissions AS role_permissions, r.is_staff
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.id = ? AND u.status IN ("active","pending") LIMIT 1'
        );
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        if (!$user) {
            self::logout();
            return null;
        }
        // Révocation de sessions (« déconnecter partout ») : rejette les sessions
        // établies avant le seuil sessions_valid_after.
        $authTime = (int) Session::get('_auth_time', 0);
        if (!\Amoura\Models\User::isSessionValid($user['sessions_valid_after'] ?? null, $authTime)) {
            self::logout();
            return null;
        }
        self::$cache = $user;
        return $user;
    }

    public static function isStaff(): bool
    {
        $u = self::user();
        return $u !== null && (int) $u['is_staff'] === 1;
    }

    /** Vérifie une permission (« * » = super-admin tout permis). */
    public static function can(string $permission): bool
    {
        $u = self::user();
        if ($u === null) {
            return false;
        }
        $perms = json_decode((string) ($u['role_permissions'] ?? '[]'), true) ?: [];
        return in_array('*', $perms, true) || in_array($permission, $perms, true);
    }
}
