<?php
/* ==========================================================================
   core/Auth.php — Authentification par JWT : utilisateur courant + gardes.
   ========================================================================== */

class Auth
{
    private static $userCache = false; // false = non résolu, null = anonyme

    /** Retourne l'utilisateur courant (depuis le token Bearer) ou null. */
    public static function courant(): ?array
    {
        if (self::$userCache !== false) {
            return self::$userCache;
        }
        self::$userCache = null;
        $token = Request::bearer();
        if ($token) {
            $payload = Jwt::decoder($token);
            if ($payload && isset($payload['sub'])) {
                self::$userCache = (new User())->trouver((int) $payload['sub']);
            }
        }
        return self::$userCache;
    }

    /** Exige une session valide ; sinon 401. Retourne l'utilisateur. */
    public static function exiger(): array
    {
        $u = self::courant();
        if (!$u) {
            Response::erreur('Authentification requise.', 401);
        }
        return $u;
    }

    /** Exige un rôle précis ; sinon 403. */
    public static function exigerRole(string $role): array
    {
        $u = self::exiger();
        if ($u['role'] !== $role) {
            Response::erreur('Accès refusé (rôle ' . $role . ' requis).', 403);
        }
        return $u;
    }
}
