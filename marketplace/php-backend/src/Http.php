<?php
declare(strict_types=1);

/** Http — utilitaires requête/réponse (JSON, CORS, corps, jeton porteur). */
final class Http
{
    /** Envoie une réponse JSON puis termine. */
    public static function json(array $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok(array $extra = []): never { self::json(['ok' => true] + $extra); }
    public static function error(string $msg, int $status = 400): never { self::json(['ok' => false, 'error' => $msg], $status); }

    /** Corps JSON de la requête (tableau associatif, vide si invalide). */
    public static function body(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    /** Jeton porteur de l'en-tête Authorization. */
    public static function bearer(): string
    {
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if ($h === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $v) {
                if (strcasecmp($k, 'authorization') === 0) { $h = $v; break; }
            }
        }
        return preg_match('/^Bearer\s+(.+)$/i', (string) $h, $m) ? trim($m[1]) : '';
    }

    public static function adminToken(): string
    {
        $h = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
        if ($h === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $v) {
                if (strcasecmp($k, 'x-admin-token') === 0) { $h = $v; break; }
            }
        }
        return (string) $h;
    }

    /** CORS + préflight (origines autorisées via ALLOWED_ORIGINS, séparées par des virgules). */
    public static function cors(): void
    {
        $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = array_filter(array_map('trim', explode(',', getenv('ALLOWED_ORIGINS') ?: '')));
        if ($origin !== '' && ($allowed === [] || in_array($origin, $allowed, true))) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public static function query(string $key, ?string $default = null): ?string
    {
        return isset($_GET[$key]) ? (string) $_GET[$key] : $default;
    }

    public static function intQuery(string $key, int $default): int
    {
        return isset($_GET[$key]) && is_numeric($_GET[$key]) ? (int) $_GET[$key] : $default;
    }

    /** Pagination standard { items, total, limit, offset, hasMore }. */
    public static function page(array $items): array
    {
        $total  = count($items);
        $limit  = max(1, min(self::intQuery('limit', 50), 500));
        $offset = max(0, self::intQuery('offset', 0));
        return [
            'items'   => array_values(array_slice($items, $offset, $limit)),
            'total'   => $total,
            'limit'   => $limit,
            'offset'  => $offset,
            'hasMore' => ($offset + $limit) < $total,
        ];
    }
}
