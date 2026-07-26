<?php
declare(strict_types=1);

namespace Amoura\Core;

/**
 * Gestion de session sécurisée (cookies httpOnly, SameSite, régénération d'ID).
 */
final class Session
{
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $secure = str_starts_with((string) Env::get('APP_URL', ''), 'https');
        session_set_cookie_params([
            'lifetime' => Env::int('SESSION_LIFETIME', 120) * 60,
            'path'     => '/',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_name('amoura_sess');
        session_start();

        // Régénération périodique de l'identifiant pour limiter la fixation de session.
        if (!isset($_SESSION['_created'])) {
            $_SESSION['_created'] = time();
        } elseif (time() - $_SESSION['_created'] > 1800) {
            session_regenerate_id(true);
            $_SESSION['_created'] = time();
        }
    }

    public static function put(string $key, mixed $value): void { $_SESSION[$key] = $value; }
    public static function get(string $key, mixed $default = null): mixed { return $_SESSION[$key] ?? $default; }
    public static function has(string $key): bool { return isset($_SESSION[$key]); }
    public static function forget(string $key): void { unset($_SESSION[$key]); }

    public static function regenerate(): void
    {
        session_regenerate_id(true);
        $_SESSION['_created'] = time();
    }

    public static function flush(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
    }

    /** Message flash (affiché une seule fois). */
    public static function flash(string $key, ?string $message = null): mixed
    {
        if ($message !== null) {
            $_SESSION['_flash'][$key] = $message;
            return null;
        }
        $value = $_SESSION['_flash'][$key] ?? null;
        unset($_SESSION['_flash'][$key]);
        return $value;
    }
}
