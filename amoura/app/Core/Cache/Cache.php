<?php
declare(strict_types=1);

namespace Amoura\Core\Cache;

use Amoura\Core\Env;
use Redis;

/**
 * Fabrique/point d'accès du cache applicatif.
 * Choisit le pilote via CACHE_DRIVER (redis|array). Repli automatique sur le
 * cache mémoire si Redis est indisponible — l'application ne casse jamais.
 */
final class Cache
{
    private static ?Store $store = null;

    public static function store(): Store
    {
        if (self::$store instanceof Store) {
            return self::$store;
        }

        $driver = strtolower((string) Env::get('CACHE_DRIVER', 'array'));
        if ($driver === 'redis' && extension_loaded('redis')) {
            try {
                $redis = new Redis();
                $redis->connect(
                    (string) Env::get('REDIS_HOST', '127.0.0.1'),
                    Env::int('REDIS_PORT', 6379),
                    1.5
                );
                $pass = (string) Env::get('REDIS_PASS', '');
                if ($pass !== '') {
                    $redis->auth($pass);
                }
                $redis->ping();
                return self::$store = new RedisStore($redis, (string) Env::get('REDIS_PREFIX', 'amoura:'));
            } catch (\Throwable $e) {
                // Redis injoignable → repli mémoire (dégradation gracieuse).
                error_log('Cache: repli mémoire (Redis indisponible: ' . $e->getMessage() . ')');
            }
        }

        return self::$store = new ArrayStore();
    }

    /** Injection d'un magasin (tests). */
    public static function setStore(?Store $store): void
    {
        self::$store = $store;
    }

    // Raccourcis statiques.
    public static function get(string $key): mixed { return self::store()->get($key); }
    public static function set(string $key, mixed $value, int $ttl = 0): void { self::store()->set($key, $value, $ttl); }
    public static function has(string $key): bool { return self::store()->has($key); }
    public static function forget(string $key): void { self::store()->forget($key); }
    public static function remember(string $key, int $ttl, callable $cb): mixed { return self::store()->remember($key, $ttl, $cb); }
}
