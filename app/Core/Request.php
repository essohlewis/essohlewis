<?php

declare(strict_types=1);

namespace Transouscris\Core;

/**
 * Encapsule la requête HTTP entrante (méthode, URI, entrées, en-têtes).
 */
final class Request
{
    private array $query;
    private array $body;
    private array $server;
    private array $headers;
    private ?array $json = null;

    public function __construct(?array $query = null, ?array $body = null, ?array $server = null)
    {
        $this->query   = $query ?? $_GET;
        $this->body    = $body ?? $_POST;
        $this->server  = $server ?? $_SERVER;
        $this->headers = $this->parseHeaders();
    }

    public function method(): string
    {
        $method = strtoupper($this->server['REQUEST_METHOD'] ?? 'GET');
        // Support du method spoofing via champ _method (formulaires HTML).
        if ($method === 'POST' && isset($this->body['_method'])) {
            $spoofed = strtoupper((string) $this->body['_method']);
            if (in_array($spoofed, ['PUT', 'PATCH', 'DELETE'], true)) {
                return $spoofed;
            }
        }
        return $method;
    }

    public function path(): string
    {
        $uri  = $this->server['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        return '/' . trim($path, '/');
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $this->query[$key] ?? $this->jsonInput()[$key] ?? $default;
    }

    public function only(array $keys): array
    {
        $out = [];
        foreach ($keys as $key) {
            $out[$key] = $this->input($key);
        }
        return $out;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    public function jsonInput(): array
    {
        if ($this->json !== null) {
            return $this->json;
        }
        $raw = file_get_contents('php://input') ?: '';
        $decoded = json_decode($raw, true);
        $this->json = is_array($decoded) ? $decoded : [];
        return $this->json;
    }

    public function rawBody(): string
    {
        return file_get_contents('php://input') ?: '';
    }

    public function header(string $name, ?string $default = null): ?string
    {
        return $this->headers[strtolower($name)] ?? $default;
    }

    public function ip(): string
    {
        return $this->server['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    public function isJson(): bool
    {
        return str_contains($this->header('content-type', '') ?? '', 'application/json');
    }

    public function expectsJson(): bool
    {
        $accept = $this->header('accept', '') ?? '';
        return $this->isJson() || str_contains($accept, 'application/json');
    }

    private function parseHeaders(): array
    {
        $headers = [];
        foreach ($this->server as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = $value;
            }
        }
        if (isset($this->server['CONTENT_TYPE'])) {
            $headers['content-type'] = $this->server['CONTENT_TYPE'];
        }
        return $headers;
    }
}
