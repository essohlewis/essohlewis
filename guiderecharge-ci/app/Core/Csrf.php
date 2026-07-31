<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Protection CSRF par jeton synchronisé.
 *
 * Un jeton aléatoire est stocké en session et injecté dans chaque
 * formulaire POST via un champ caché. À la soumission, le jeton reçu
 * est comparé en temps constant (hash_equals) à celui de la session.
 */
final class Csrf
{
    /**
     * Retourne le jeton courant, en le générant au premier appel.
     */
    public static function token(): string
    {
        if (!Session::has(CSRF_TOKEN_NAME)) {
            Session::set(CSRF_TOKEN_NAME, bin2hex(random_bytes(32)));
        }
        return (string) Session::get(CSRF_TOKEN_NAME);
    }

    /**
     * Génère le champ caché HTML à insérer dans les formulaires.
     */
    public static function field(): string
    {
        $token = htmlspecialchars(self::token(), ENT_QUOTES, 'UTF-8');
        return '<input type="hidden" name="' . CSRF_TOKEN_NAME . '" value="' . $token . '">';
    }

    /**
     * Valide un jeton soumis. Comparaison en temps constant.
     */
    public static function validate(?string $token): bool
    {
        if ($token === null || $token === '' || !Session::has(CSRF_TOKEN_NAME)) {
            return false;
        }
        return hash_equals((string) Session::get(CSRF_TOKEN_NAME), $token);
    }
}
