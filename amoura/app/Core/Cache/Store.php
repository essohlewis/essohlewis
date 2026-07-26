<?php
declare(strict_types=1);

namespace Amoura\Core\Cache;

/**
 * Contrat commun des magasins de cache (Sprint +3 — passage à l'échelle).
 * Permet de basculer entre Redis (multi-instance) et un cache mémoire local.
 */
interface Store
{
    public function get(string $key): mixed;

    /** @param int $ttl durée de vie en secondes (0 = sans expiration) */
    public function set(string $key, mixed $value, int $ttl = 0): void;

    public function has(string $key): bool;

    public function forget(string $key): void;

    public function increment(string $key, int $by = 1): int;

    /** Récupère depuis le cache ou calcule puis mémorise (cache-aside). */
    public function remember(string $key, int $ttl, callable $callback): mixed;
}
