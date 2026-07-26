<?php
declare(strict_types=1);

namespace Amoura\Core\Cache;

/**
 * Cache mémoire (portée requête) — pilote par défaut et repli quand Redis
 * n'est pas configuré. Respecte les TTL pour un comportement identique.
 */
final class ArrayStore implements Store
{
    /** @var array<string,array{value:mixed,expires:int}> */
    private array $data = [];

    public function get(string $key): mixed
    {
        if (!isset($this->data[$key])) {
            return null;
        }
        $entry = $this->data[$key];
        if ($entry['expires'] !== 0 && $entry['expires'] < time()) {
            unset($this->data[$key]);
            return null;
        }
        return $entry['value'];
    }

    public function set(string $key, mixed $value, int $ttl = 0): void
    {
        $this->data[$key] = ['value' => $value, 'expires' => $ttl > 0 ? time() + $ttl : 0];
    }

    public function has(string $key): bool
    {
        return $this->get($key) !== null;
    }

    public function forget(string $key): void
    {
        unset($this->data[$key]);
    }

    public function increment(string $key, int $by = 1): int
    {
        $current = (int) ($this->get($key) ?? 0);
        $new = $current + $by;
        $expires = $this->data[$key]['expires'] ?? 0;
        $this->data[$key] = ['value' => $new, 'expires' => $expires];
        return $new;
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
}
