<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\Paginator;
use PHPUnit\Framework\TestCase;

/** Pagination par curseur keyset (Sprint +6). */
final class PaginatorTest extends TestCase
{
    public function testEncodeDecodeRoundTrip(): void
    {
        $cursor = Paginator::encode(4242);
        $this->assertNotSame('', $cursor);
        $this->assertStringNotContainsString('=', $cursor, 'curseur base64url sans remplissage');
        $this->assertSame(4242, Paginator::decode($cursor));
    }

    public function testDecodeInvalidReturnsZero(): void
    {
        $this->assertSame(0, Paginator::decode(null));
        $this->assertSame(0, Paginator::decode(''));
        $this->assertSame(0, Paginator::decode('n-importe-quoi!!'));
        $this->assertSame(0, Paginator::decode(base64_encode('autre:5')));
    }

    public function testPageWithMore(): void
    {
        // 4 lignes récupérées pour une page de 3 → has_more, next_cursor = id de la 3e.
        $rows = [['id' => 10], ['id' => 9], ['id' => 8], ['id' => 7]];
        $page = Paginator::page($rows, 3, fn($r) => $r['id']);

        $this->assertCount(3, $page['data']);
        $this->assertTrue($page['has_more']);
        $this->assertSame(8, Paginator::decode($page['next_cursor']));
    }

    public function testPageWithoutMore(): void
    {
        $rows = [['id' => 3], ['id' => 2]];
        $page = Paginator::page($rows, 5, fn($r) => $r['id']);

        $this->assertCount(2, $page['data']);
        $this->assertFalse($page['has_more']);
        $this->assertNull($page['next_cursor']);
    }
}
