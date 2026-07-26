<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

use Amoura\Core\Session;

/**
 * Protection CSRF par jeton synchronisé (double submit + comparaison constante).
 */
final class Csrf
{
    private const KEY = '_csrf_token';

    public static function token(): string
    {
        $token = Session::get(self::KEY);
        if (!is_string($token) || $token === '') {
            $token = bin2hex(random_bytes(32));
            Session::put(self::KEY, $token);
        }
        return $token;
    }

    public static function verify(string $submitted): bool
    {
        $token = Session::get(self::KEY);
        if (!is_string($token) || $token === '' || $submitted === '') {
            return false;
        }
        return hash_equals($token, $submitted);
    }

    /** Champ caché prêt à insérer dans un formulaire. */
    public static function field(): string
    {
        return '<input type="hidden" name="_csrf" value="' . htmlspecialchars(self::token(), ENT_QUOTES) . '">';
    }
}
