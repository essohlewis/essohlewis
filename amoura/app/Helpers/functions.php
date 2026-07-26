<?php
declare(strict_types=1);

use Amoura\Core\Env;
use Amoura\Core\Security\Sanitizer;
use Amoura\Core\Security\Csrf;
use Amoura\Core\Security\Nonce;

/**
 * Helpers globaux disponibles partout (chargés via Composer "files" ou bootstrap).
 */

if (!function_exists('e')) {
    /** Échappement HTML anti-XSS pour les vues. */
    function e(mixed $value): string
    {
        return Sanitizer::e($value);
    }
}

if (!function_exists('env')) {
    function env(string $key, mixed $default = null): mixed
    {
        return Env::get($key, $default);
    }
}

if (!function_exists('config')) {
    /** Petit accès aux réglages applicatifs dérivés de l'environnement. */
    function config(string $key, mixed $default = null): mixed
    {
        return Env::get(strtoupper(str_replace('.', '_', $key)), $default);
    }
}

if (!function_exists('csrf_field')) {
    function csrf_field(): string
    {
        return Csrf::field();
    }
}

if (!function_exists('csp_nonce')) {
    /** Nonce CSP de la requête courante (pour les balises <script> inline). */
    function csp_nonce(): string
    {
        return Nonce::get();
    }
}

if (!function_exists('t')) {
    /** Traduit une clé i18n (avec substitution {var}). */
    function t(string $key, array $replacements = []): string
    {
        return \Amoura\Core\I18n::t($key, $replacements);
    }
}

if (!function_exists('locale')) {
    function locale(): string
    {
        return \Amoura\Core\I18n::locale();
    }
}

if (!function_exists('old')) {
    /** Récupère une ancienne valeur de formulaire (repopulation après erreur). */
    function old(string $key, mixed $default = ''): mixed
    {
        return $_SESSION['_old'][$key] ?? $default;
    }
}

if (!function_exists('asset')) {
    function asset(string $path): string
    {
        return '/assets/' . ltrim($path, '/');
    }
}

if (!function_exists('url')) {
    function url(string $path = ''): string
    {
        $base = rtrim((string) Env::get('APP_URL', ''), '/');
        return $base . '/' . ltrim($path, '/');
    }
}

if (!function_exists('time_ago')) {
    /** Formatage « il y a X » en français. */
    function time_ago(?string $datetime): string
    {
        if (!$datetime) {
            return '';
        }
        $ts = strtotime($datetime);
        $diff = time() - $ts;
        if ($diff < 60)      return "à l'instant";
        if ($diff < 3600)    return 'il y a ' . floor($diff / 60) . ' min';
        if ($diff < 86400)   return 'il y a ' . floor($diff / 3600) . ' h';
        if ($diff < 604800)  return 'il y a ' . floor($diff / 86400) . ' j';
        return date('d/m/Y', $ts);
    }
}

if (!function_exists('age_from')) {
    function age_from(?string $birthdate): ?int
    {
        if (!$birthdate) {
            return null;
        }
        $dob = DateTime::createFromFormat('Y-m-d', $birthdate);
        return $dob ? (new DateTime())->diff($dob)->y : null;
    }
}

if (!function_exists('avatar_url')) {
    /** Avatar par défaut cohérent si l'utilisateur n'a pas de photo. */
    function avatar_url(?string $path): string
    {
        return $path ? '/uploads/' . ltrim($path, '/') : '/assets/img/avatar-placeholder.svg';
    }
}
