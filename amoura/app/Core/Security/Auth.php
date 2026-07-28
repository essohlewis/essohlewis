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
    /** Jeton API courant lorsqu'on est authentifié sans session (clients mobiles). */
    private static ?array $apiToken = null;

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
        // Authentification stateless (jeton API) : l'utilisateur est déjà en cache,
        // sans session — on retourne son identifiant directement.
        if (self::$cache !== null && isset(self::$cache['id'])) {
            return (int) self::$cache['id'];
        }
        $id = Session::get(self::SESSION_KEY);
        return is_int($id) ? $id : (is_numeric($id) ? (int) $id : null);
    }

    /**
     * Authentifie la requête courante à partir d'un utilisateur déjà résolu
     * (via un jeton API), sans toucher à la session. Le reste de la requête voit
     * cet utilisateur via Auth::user() / Auth::id() / Auth::can().
     *
     * @param array<string,mixed> $user
     * @param array<string,mixed>|null $token ligne api_tokens associée (pour les portées).
     */
    public static function actingAs(array $user, ?array $token = null): void
    {
        self::$cache = $user;
        self::$apiToken = $token;
    }

    /** Jeton API de la requête courante (null en contexte web/session). @return array<string,mixed>|null */
    public static function apiToken(): ?array
    {
        return self::$apiToken;
    }

    /** Le jeton API courant accorde-t-il la portée demandée ? (true si contexte web/session). */
    public static function tokenAllows(string $ability): bool
    {
        if (self::$apiToken === null) {
            return true; // hors contexte jeton : pas de restriction de portée
        }
        return \Amoura\Models\ApiToken::allows(
            \Amoura\Models\ApiToken::abilitiesOf(self::$apiToken),
            $ability
        );
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
