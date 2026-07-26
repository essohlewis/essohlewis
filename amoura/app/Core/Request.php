<?php
declare(strict_types=1);

namespace Amoura\Core;

/**
 * Encapsule la requête HTTP entrante (superglobales).
 * Toute lecture d'entrée utilisateur passe idéalement par ici.
 */
final class Request
{
    private array $query;
    private array $body;
    private array $server;
    private ?array $json = null;

    public function __construct()
    {
        $this->query  = $_GET;
        $this->body   = $_POST;
        $this->server = $_SERVER;
    }

    public function method(): string
    {
        $method = strtoupper($this->server['REQUEST_METHOD'] ?? 'GET');
        // Support du method override pour les formulaires HTML (_method).
        if ($method === 'POST' && isset($this->body['_method'])) {
            $override = strtoupper((string) $this->body['_method']);
            if (in_array($override, ['PUT', 'PATCH', 'DELETE'], true)) {
                return $override;
            }
        }
        return $method;
    }

    public function path(): string
    {
        $uri = $this->server['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        return '/' . trim($path, '/');
    }

    public function isJson(): bool
    {
        return str_contains($this->server['CONTENT_TYPE'] ?? '', 'application/json');
    }

    public function wantsJson(): bool
    {
        $accept = $this->server['HTTP_ACCEPT'] ?? '';
        return $this->isJson()
            || str_contains($accept, 'application/json')
            || ($this->server['HTTP_X_REQUESTED_WITH'] ?? '') === 'XMLHttpRequest';
    }

    private function jsonBody(): array
    {
        if ($this->json === null) {
            $raw = file_get_contents('php://input') ?: '';
            $decoded = json_decode($raw, true);
            $this->json = is_array($decoded) ? $decoded : [];
        }
        return $this->json;
    }

    /** Récupère une valeur d'entrée (JSON, POST, puis GET). */
    public function input(string $key, mixed $default = null): mixed
    {
        if ($this->isJson()) {
            return $this->jsonBody()[$key] ?? $default;
        }
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    public function all(): array
    {
        return $this->isJson()
            ? $this->jsonBody()
            : array_merge($this->query, $this->body);
    }

    public function file(string $key): ?array
    {
        return $_FILES[$key] ?? null;
    }

    public function ip(): string
    {
        // Attention : ne faire confiance à X-Forwarded-For que derrière un proxy de confiance.
        return $this->server['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    public function userAgent(): string
    {
        return substr($this->server['HTTP_USER_AGENT'] ?? '', 0, 255);
    }

    public function bearerToken(): ?string
    {
        $header = $this->server['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.+)/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }
}
