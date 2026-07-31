<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Gestion des sessions sécurisées.
 *
 * Démarre la session avec des cookies httponly + samesite=Lax, fournit
 * des accesseurs simples, gère les messages flash et la régénération
 * d'identifiant (à effectuer après connexion pour éviter la fixation).
 */
final class Session
{
    /** Démarre la session si elle ne l'est pas déjà. */
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['SERVER_PORT'] ?? null) == 443;

        session_name(SESSION_NAME);
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'httponly' => true,
            'secure'   => $secure,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    /** Régénère l'identifiant de session (anti-fixation). */
    public static function regenerate(): void
    {
        session_regenerate_id(true);
    }

    /** Détruit intégralement la session (déconnexion). */
    public static function destroy(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
    }

    /**
     * Enregistre un message flash (disponible une seule fois).
     */
    public static function flash(string $type, string $message): void
    {
        $_SESSION['_flash'][$type] = $message;
    }

    /**
     * Récupère et supprime tous les messages flash.
     *
     * @return array<string, string>
     */
    public static function pullFlash(): array
    {
        $flash = $_SESSION['_flash'] ?? [];
        unset($_SESSION['_flash']);
        return $flash;
    }
}
