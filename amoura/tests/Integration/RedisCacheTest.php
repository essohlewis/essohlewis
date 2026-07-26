<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Core\Cache\RedisStore;
use PHPUnit\Framework\TestCase;
use Redis;

/**
 * Vérifie le magasin de cache Redis contre un vrai serveur Redis.
 * Ignoré si l'extension phpredis manque ou si Redis est injoignable.
 */
final class RedisCacheTest extends TestCase
{
    private RedisStore $store;

    protected function setUp(): void
    {
        if (!extension_loaded('redis')) {
            $this->markTestSkipped('Extension phpredis absente.');
        }
        $redis = new Redis();
        try {
            $host = getenv('REDIS_HOST') ?: '127.0.0.1';
            $port = (int) (getenv('REDIS_PORT') ?: 6379);
            if (!@$redis->connect($host, $port, 1.0)) {
                $this->markTestSkipped('Redis injoignable.');
            }
            $redis->ping();
        } catch (\Throwable $e) {
            $this->markTestSkipped('Redis injoignable : ' . $e->getMessage());
        }
        $redis->flushDB();
        $this->store = new RedisStore($redis, 'amoura_test:');
    }

    public function testRoundTripPreservesStructure(): void
    {
        $this->store->set('map', ['a' => 1, 'b' => true, 'c' => 'x']);
        $this->assertSame(['a' => 1, 'b' => true, 'c' => 'x'], $this->store->get('map'));
        $this->assertTrue($this->store->has('map'));
        $this->store->forget('map');
        $this->assertFalse($this->store->has('map'));
    }

    public function testAtomicIncrementForRateLimiting(): void
    {
        $this->assertSame(1, $this->store->increment('rl:test'));
        $this->assertSame(2, $this->store->increment('rl:test'));
        $this->store->expire('rl:test', 60);
    }

    public function testRememberCachesValue(): void
    {
        $calls = 0;
        $fn = function () use (&$calls) { $calls++; return ['v' => 42]; };
        $this->assertSame(['v' => 42], $this->store->remember('memo', 60, $fn));
        $this->assertSame(['v' => 42], $this->store->remember('memo', 60, $fn));
        $this->assertSame(1, $calls);
    }
}
