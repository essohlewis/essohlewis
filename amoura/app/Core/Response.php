<?php
declare(strict_types=1);

namespace Amoura\Core;

/**
 * Réponses HTTP (JSON, redirections, en-têtes de sécurité).
 */
final class Response
{
    public static function json(mixed $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status = 400, array $extra = []): void
    {
        self::json(array_merge(['ok' => false, 'error' => $message], $extra), $status);
    }

    public static function ok(array $data = []): void
    {
        self::json(array_merge(['ok' => true], $data), 200);
    }

    public static function redirect(string $to, int $status = 302): void
    {
        header('Location: ' . $to, true, $status);
        exit;
    }

    /** En-têtes de sécurité appliqués à chaque réponse HTML. */
    public static function securityHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('X-XSS-Protection: 0'); // désactivé au profit de la CSP
        header("Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)");
        // CSP : autorise WebRTC/WebSocket ; 'unsafe-inline' réduit au strict minimum côté vues.
        $ws = Env::get('WS_PUBLIC_URL', 'ws://localhost:8090');
        // Note : 'unsafe-inline' pour les scripts est requis par les gestionnaires
        // inline (onclick=) et les petits blocs <script> des vues vanilla. Pour un
        // durcissement maximal, migrez vers des nonces + handlers externes.
        header(
            "Content-Security-Policy: default-src 'self'; "
            . "img-src 'self' data: blob:; media-src 'self' blob:; "
            . "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
            . "connect-src 'self' {$ws} wss:; frame-ancestors 'none'; base-uri 'self'"
        );
    }
}
