<?php

declare(strict_types=1);

/**
 * Fonctions utilitaires globales de présentation.
 *
 * Chargées au bootstrap. Elles rendent les vues concises tout en
 * garantissant l'échappement systématique des sorties (anti-XSS).
 */

use App\Core\Session;

if (!function_exists('e')) {
    /**
     * Échappe une chaîne pour affichage HTML sûr (anti-XSS).
     * À utiliser sur TOUTE donnée dynamique injectée dans une vue.
     */
    function e(mixed $value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (!function_exists('asset')) {
    /**
     * Construit l'URL d'un asset public en tenant compte de BASE_URL.
     */
    function asset(string $path): string
    {
        return BASE_URL . '/assets/' . ltrim($path, '/');
    }
}

if (!function_exists('url')) {
    /** Construit une URL interne préfixée par BASE_URL. */
    function url(string $path = '/'): string
    {
        return BASE_URL . '/' . ltrim($path, '/');
    }
}

if (!function_exists('redirect')) {
    /** Redirige vers un chemin interne. */
    function redirect(string $path): never
    {
        header('Location: ' . BASE_URL . $path);
        exit;
    }
}

if (!function_exists('old')) {
    /**
     * Récupère une ancienne valeur de formulaire (repopulation après erreur).
     *
     * @param array<string, mixed>|null $source
     */
    function old(string $key, ?array $source = null, mixed $default = ''): string
    {
        $data = $source ?? Session::get('_old', []);
        return e($data[$key] ?? $default);
    }
}

if (!function_exists('active')) {
    /**
     * Retourne 'active' si le chemin courant correspond, pour la navigation.
     */
    function active(string $needle): string
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        if (BASE_URL !== '' && str_starts_with($path, BASE_URL)) {
            $path = substr($path, strlen(BASE_URL));
        }
        $path = '/' . trim($path, '/');
        if ($needle === '/') {
            return $path === '/' ? 'active' : '';
        }
        return str_starts_with($path, $needle) ? 'active' : '';
    }
}

if (!function_exists('fcfa')) {
    /**
     * Formate un montant entier en FCFA avec séparateur de milliers.
     */
    function fcfa(int|string|null $montant): string
    {
        $n = (int) ($montant ?? 0);
        return number_format($n, 0, ',', ' ') . ' FCFA';
    }
}

if (!function_exists('slugify')) {
    /**
     * Transforme un titre en slug URL (minuscules, tirets).
     */
    function slugify(string $text): string
    {
        $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
        $text = strtolower(trim($text));
        $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
        return trim($text, '-') ?: 'element';
    }
}

if (!function_exists('excerpt')) {
    /**
     * Retourne un extrait texte (balises retirées) d'une longueur donnée.
     */
    function excerpt(string $html, int $length = 140): string
    {
        $text = trim(preg_replace('/\s+/', ' ', strip_tags($html)) ?? '');
        if (mb_strlen($text) <= $length) {
            return $text;
        }
        return mb_substr($text, 0, $length) . '…';
    }
}
