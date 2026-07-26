<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Cache\ArrayStore;
use PHPUnit\Framework\TestCase;

final class CacheTest extends TestCase
{
    public function testSetGetHasForget(): void
    {
        $c = new ArrayStore();
        $this->assertNull($c->get('missing'));
        $c->set('k', 'v');
        $this->assertSame('v', $c->get('k'));
        $this->assertTrue($c->has('k'));
        $c->forget('k');
        $this->assertFalse($c->has('k'));
    }

    public function testTtlValueReadableAndZeroMeansPersistent(): void
    {
        $c = new ArrayStore();
        $c->set('temp', 'x', 60);          // TTL positif : lisible immédiatement
        $this->assertSame('x', $c->get('temp'));
        $c->set('perma', 'y', 0);          // 0 = pas d'expiration (contrat de l'interface)
        $this->assertSame('y', $c->get('perma'));
        $c->set('temp', 'z');              // écrasement
        $this->assertSame('z', $c->get('temp'));
    }

    public function testIncrement(): void
    {
        $c = new ArrayStore();
        $this->assertSame(1, $c->increment('n'));
        $this->assertSame(4, $c->increment('n', 3));
    }

    public function testRememberComputesOnceThenCaches(): void
    {
        $c = new ArrayStore();
        $calls = 0;
        $fn = function () use (&$calls) { $calls++; return 'computed'; };
        $this->assertSame('computed', $c->remember('key', 60, $fn));
        $this->assertSame('computed', $c->remember('key', 60, $fn));
        $this->assertSame(1, $calls, 'le callback ne doit être appelé qu\'une fois');
    }

    public function testStoresStructuredValues(): void
    {
        $c = new ArrayStore();
        $c->set('map', ['a' => 1, 'b' => true]);
        $this->assertSame(['a' => 1, 'b' => true], $c->get('map'));
    }
}
