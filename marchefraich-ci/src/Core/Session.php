<?php
/**
 * Gestion de session et authentification multi-rôles.
 *
 * Chaque rôle (client, vendeuse, coursier, admin) est stocké séparément
 * en session, ce qui permet de rester connecté sur plusieurs espaces si
 * besoin, et d'isoler les contrôles d'accès.
 */

declare(strict_types=1);

namespace App\Core;

class Session
{
    public static function demarrer(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    /** Connecte un utilisateur pour un rôle donné. */
    public static function connecter(string $role, array $utilisateur): void
    {
        self::demarrer();
        $_SESSION['auth'][$role] = $utilisateur;
    }

    /** Déconnecte un rôle précis. */
    public static function deconnecter(string $role): void
    {
        self::demarrer();
        unset($_SESSION['auth'][$role]);
    }

    /** Retourne l'utilisateur connecté pour un rôle, ou null. */
    public static function utilisateur(string $role): ?array
    {
        self::demarrer();
        return $_SESSION['auth'][$role] ?? null;
    }

    public static function estConnecte(string $role): bool
    {
        return self::utilisateur($role) !== null;
    }

    /** Redirige vers la connexion si le rôle n'est pas authentifié. */
    public static function exiger(string $role, string $redirection): void
    {
        if (!self::estConnecte($role)) {
            header('Location: ' . $redirection);
            exit;
        }
    }

    // ------- Messages flash (affichés une seule fois) -------

    public static function flash(string $type, string $message): void
    {
        self::demarrer();
        $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
    }

    /** @return array<int,array{type:string,message:string}> */
    public static function recupererFlashs(): array
    {
        self::demarrer();
        $flashs = $_SESSION['flash'] ?? [];
        unset($_SESSION['flash']);
        return $flashs;
    }

    // ------- Jeton CSRF -------

    public static function jetonCsrf(): string
    {
        self::demarrer();
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }

    public static function verifierCsrf(?string $jeton): bool
    {
        self::demarrer();
        return is_string($jeton)
            && !empty($_SESSION['csrf'])
            && hash_equals($_SESSION['csrf'], $jeton);
    }
}
