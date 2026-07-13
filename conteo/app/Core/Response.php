<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Helpers de réponse JSON. Envoie les en-têtes de sécurité de base.
 */
final class Response
{
    public static function json(mixed $data, int $status = 200, array $headers = []): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: no-referrer');
        foreach ($headers as $k => $v) {
            header("$k: $v");
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function ok(mixed $data = [], int $status = 200): void
    {
        self::json(['ok' => true, 'data' => $data], $status);
    }

    /**
     * @param array<string,string[]> $errors
     */
    public static function error(string $message, int $status = 400, array $errors = []): void
    {
        $payload = ['ok' => false, 'error' => $message];
        if ($errors) {
            $payload['errors'] = $errors;
        }
        self::json($payload, $status);
    }

    public static function noContent(): void
    {
        http_response_code(204);
    }
}
