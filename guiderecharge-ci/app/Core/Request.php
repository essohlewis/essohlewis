<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Encapsule la requête HTTP entrante ($_GET, $_POST, $_SERVER).
 *
 * Centralise la lecture des entrées afin que les contrôleurs n'accèdent
 * jamais directement aux super-globales. Toute donnée reste brute ici ;
 * la validation et l'échappement se font dans les couches supérieures.
 */
final class Request
{
    /**
     * Méthode HTTP (GET, POST, ...). Gère le champ caché _method pour
     * simuler PUT/DELETE depuis un formulaire HTML.
     */
    public function method(): string
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'POST' && isset($_POST['_method'])) {
            $override = strtoupper((string) $_POST['_method']);
            if (in_array($override, ['PUT', 'PATCH', 'DELETE'], true)) {
                return $override;
            }
        }
        return $method;
    }

    /**
     * Chemin de l'URI sans query string ni BASE_URL, toujours préfixé « / ».
     */
    public function path(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $uri = rawurldecode($uri);

        // Retire le préfixe BASE_URL éventuel (installation en sous-dossier).
        if (BASE_URL !== '' && str_starts_with($uri, BASE_URL)) {
            $uri = substr($uri, strlen(BASE_URL));
        }

        $uri = '/' . trim($uri, '/');
        return $uri === '/' ? '/' : rtrim($uri, '/');
    }

    /** Retourne une valeur GET, avec valeur par défaut. */
    public function query(string $key, mixed $default = null): mixed
    {
        return $_GET[$key] ?? $default;
    }

    /** Retourne une valeur POST, avec valeur par défaut. */
    public function post(string $key, mixed $default = null): mixed
    {
        return $_POST[$key] ?? $default;
    }

    /**
     * Retourne l'intégralité des données POST.
     *
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return $_POST;
    }

    /** Vrai si la requête attend une réponse JSON (fetch/AJAX). */
    public function wantsJson(): bool
    {
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        $xrw = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
        return str_contains($accept, 'application/json')
            || strtolower($xrw) === 'xmlhttprequest';
    }

    /** Adresse IP du client (utile pour le rate-limiting). */
    public function ip(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
