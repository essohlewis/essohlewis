<?php

declare(strict_types=1);

use Transouscris\Core\Config;
use Transouscris\Core\Csrf;
use Transouscris\Core\View;

/**
 * Fonctions d'aide globales pour les vues. Chargées au bootstrap.
 */

if (!function_exists('e')) {
    /** Échappement HTML sûr. */
    function e(mixed $value): string
    {
        return View::e($value);
    }
}

if (!function_exists('csrf_field')) {
    function csrf_field(): string
    {
        return Csrf::field();
    }
}

if (!function_exists('money')) {
    /** Formate un montant en unités mineures XOF : 1500 → "1 500 F CFA". */
    function money(int $minor): string
    {
        return number_format($minor, 0, ',', ' ') . ' F CFA';
    }
}

if (!function_exists('config')) {
    function config(string $key, mixed $default = null): mixed
    {
        return Config::get($key, $default);
    }
}

if (!function_exists('asset')) {
    function asset(string $path): string
    {
        return rtrim((string) Config::get('app.url'), '/') . '/' . ltrim($path, '/');
    }
}
