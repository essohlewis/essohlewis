<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Encapsule la requête HTTP entrante.
 * Le corps JSON est décodé une fois et mis en cache.
 */
final class Request
{
    private array $json;
    private array $query;
    private array $params = [];

    public function __construct()
    {
        $this->query = $_GET;
        $raw = file_get_contents('php://input') ?: '';
        $decoded = json_decode($raw, true);
        $this->json = is_array($decoded) ? $decoded : [];
    }

    public function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public function path(): string
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        return '/' . trim($path, '/');
    }

    /** Paramètres extraits du pattern de route ({id}, {slug}...). */
    public function setParams(array $params): void
    {
        $this->params = $params;
    }

    public function param(string $key, mixed $default = null): mixed
    {
        return $this->params[$key] ?? $default;
    }

    /** Valeur du corps JSON. */
    public function input(string $key, mixed $default = null): mixed
    {
        return $this->json[$key] ?? $default;
    }

    public function all(): array
    {
        return $this->json;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    public function bearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($header === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header = $headers['Authorization'] ?? '';
        }
        if (preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }

    public function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return $_SERVER[$key] ?? null;
    }

    public function ip(): string
    {
        // Derrière un proxy de confiance uniquement ; sinon REMOTE_ADDR.
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
