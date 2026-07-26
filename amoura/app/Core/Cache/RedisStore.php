<?php
declare(strict_types=1);

namespace Amoura\Core\Cache;

use Redis;

/**
 * Cache Redis partagé entre instances (sessions, rate-limit, réglages CMS).
 * Les valeurs sont sérialisées (JSON) pour rester interopérables.
 * Utilise l'extension phpredis.
 */
final class RedisStore implements Store
{
    private string $prefix;

    public function __construct(private Redis $redis, string $prefix = 'amoura:')
    {
        $this->prefix = $prefix;
    }

    private function k(string $key): string
    {
        return $this->prefix . $key;
    }

    public function get(string $key): mixed
    {
        $raw = $this->redis->get($this->k($key));
        if ($raw === false) {
            return null;
        }
        $decoded = json_decode((string) $raw, true);
        return $decoded['v'] ?? null;
    }

    public function set(string $key, mixed $value, int $ttl = 0): void
    {
        $payload = json_encode(['v' => $value]);
        if ($ttl > 0) {
            $this->redis->setex($this->k($key), $ttl, $payload);
        } else {
            $this->redis->set($this->k($key), $payload);
        }
    }

    public function has(string $key): bool
    {
        return (bool) $this->redis->exists($this->k($key));
    }

    public function forget(string $key): void
    {
        $this->redis->del($this->k($key));
    }

    public function increment(string $key, int $by = 1): int
    {
        // Compteur atomique natif Redis (idéal pour le rate-limiting distribué).
        return (int) $this->redis->incrBy($this->k($key), $by);
    }

    public function remember(string $key, int $ttl, callable $callback): mixed
    {
        $cached = $this->get($key);
        if ($cached !== null) {
            return $cached;
        }
        $value = $callback();
        $this->set($key, $value, $ttl);
        return $value;
    }

    /** Fixe une expiration sur une clé (utile après un premier increment). */
    public function expire(string $key, int $ttl): void
    {
        $this->redis->expire($this->k($key), $ttl);
    }

    public function client(): Redis
    {
        return $this->redis;
    }
}
