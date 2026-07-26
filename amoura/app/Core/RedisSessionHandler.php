<?php
declare(strict_types=1);

namespace Amoura\Core;

use Redis;
use SessionHandlerInterface;

/**
 * Gestionnaire de sessions Redis (Sprint +3 — multi-instance).
 * Permet à plusieurs serveurs web de partager les sessions ; l'expiration est
 * gérée nativement par le TTL Redis.
 */
final class RedisSessionHandler implements SessionHandlerInterface
{
    public function __construct(
        private Redis $redis,
        private int $ttl,
        private string $prefix = 'amoura:sess:'
    ) {}

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        $data = $this->redis->get($this->prefix . $id);
        return $data === false ? '' : (string) $data;
    }

    public function write(string $id, string $data): bool
    {
        return (bool) $this->redis->setex($this->prefix . $id, $this->ttl, $data);
    }

    public function destroy(string $id): bool
    {
        $this->redis->del($this->prefix . $id);
        return true;
    }

    public function gc(int $maxLifetime): int|false
    {
        // Le TTL Redis expire les sessions automatiquement — rien à balayer.
        return 0;
    }
}
