<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Request;
use Amoura\Core\Router;
use PHPUnit\Framework\TestCase;

final class RouterTest extends TestCase
{
    private function dispatch(Router $r, string $method, string $uri): void
    {
        $_SERVER['REQUEST_METHOD'] = $method;
        $_SERVER['REQUEST_URI'] = $uri;
        $r->dispatch(new Request());
    }

    public function testMatchesNamedParameters(): void
    {
        $captured = null;
        $r = new Router();
        $r->get('/u/{id}', function ($req, $p) use (&$captured) { $captured = $p['id']; });
        $this->dispatch($r, 'GET', '/u/42');
        $this->assertSame('42', $captured);
    }

    public function testGroupPrefixAndMultipleParams(): void
    {
        $captured = null;
        $r = new Router();
        $r->group(['prefix' => '/admin'], function (Router $r) use (&$captured) {
            $r->get('/members/{id}', function ($req, $p) use (&$captured) { $captured = 'm' . $p['id']; });
        });
        $this->dispatch($r, 'GET', '/admin/members/7');
        $this->assertSame('m7', $captured);
    }

    public function testMiddlewareCanShortCircuit(): void
    {
        $reached = false;
        $r = new Router();
        $blocker = new class {
            public function handle($req, $params): bool { return false; } // stoppe la chaîne
        };
        $r->get('/secret', function () use (&$reached) { $reached = true; }, [$blocker]);
        $this->dispatch($r, 'GET', '/secret');
        $this->assertFalse($reached, 'le contrôleur ne doit pas être atteint si un middleware retourne false');
    }

    public function testMethodOverrideViaPostField(): void
    {
        $_POST['_method'] = 'DELETE';
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SERVER['REQUEST_URI'] = '/x';
        $this->assertSame('DELETE', (new Request())->method());
        unset($_POST['_method']);
    }
}
