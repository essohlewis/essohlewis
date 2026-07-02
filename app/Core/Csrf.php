<?php

declare(strict_types=1);

namespace Transouscris\Core;

/**
 * Protection CSRF par jeton synchronisé stocké en session.
 * Le jeton est vérifié en temps constant (hash_equals).
 */
final class Csrf
{
    private const SESSION_KEY = '_csrf_token';

    public static function token(): string
    {
        $token = Session::get(self::SESSION_KEY);
        if (!is_string($token) || $token === '') {
            $token = bin2hex(random_bytes(32));
            Session::set(self::SESSION_KEY, $token);
        }
        return $token;
    }

    public static function field(): string
    {
        $token = htmlspecialchars(self::token(), ENT_QUOTES, 'UTF-8');
        return '<input type="hidden" name="_csrf" value="' . $token . '">';
    }

    public static function verify(?string $candidate): bool
    {
        $token = Session::get(self::SESSION_KEY);
        if (!is_string($token) || !is_string($candidate) || $candidate === '') {
            return false;
        }
        return hash_equals($token, $candidate);
    }

    public static function rotate(): void
    {
        Session::forget(self::SESSION_KEY);
    }
}
