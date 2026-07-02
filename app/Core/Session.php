<?php

declare(strict_types=1);

namespace Transouscris\Core;

/**
 * Enveloppe autour de la session PHP avec cookies sécurisés.
 */
final class Session
{
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $cfg = Config::get('session');
        session_set_cookie_params([
            'lifetime' => $cfg['lifetime'] ?? 7200,
            'path'     => '/',
            'domain'   => '',
            'secure'   => (bool) ($cfg['secure'] ?? false),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_name($cfg['name'] ?? 'transouscris_session');
        session_start();
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public static function regenerate(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    /** Messages flash (affichés une seule fois). */
    public static function flash(string $key, ?string $message = null): mixed
    {
        if ($message !== null) {
            $_SESSION['_flash'][$key] = $message;
            return null;
        }
        $value = $_SESSION['_flash'][$key] ?? null;
        unset($_SESSION['_flash'][$key]);
        return $value;
    }

    public static function userId(): ?int
    {
        $id = $_SESSION['user_id'] ?? null;
        return $id !== null ? (int) $id : null;
    }
}
