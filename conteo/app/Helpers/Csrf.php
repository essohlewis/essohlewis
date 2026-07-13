<?php

declare(strict_types=1);

namespace App\Helpers;

/**
 * Jetons CSRF pour les formulaires de l'admin (basé sur la session PHP).
 * L'API REST publique s'appuie sur le Bearer token et n'utilise pas les cookies,
 * elle n'est donc pas exposée au CSRF.
 */
final class Csrf
{
    private const KEY = '_conteo_csrf';

    public static function token(): string
    {
        self::ensureSession();
        if (empty($_SESSION[self::KEY])) {
            $_SESSION[self::KEY] = bin2hex(random_bytes(32));
        }
        return $_SESSION[self::KEY];
    }

    public static function verify(?string $token): bool
    {
        self::ensureSession();
        $stored = $_SESSION[self::KEY] ?? '';
        return is_string($token) && $token !== '' && hash_equals($stored, $token);
    }

    public static function field(): string
    {
        $t = self::token();
        return '<input type="hidden" name="_csrf" value="' . Sanitize::html($t) . '">';
    }

    private static function ensureSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
    }
}
