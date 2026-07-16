<?php
use PHPUnit\Framework\TestCase;

class PaginationTest extends TestCase
{
    protected function tearDown(): void
    {
        $_GET = [];
    }

    public function testSansParametresRenvoieTouteLaListe(): void
    {
        $_GET = [];
        $items = range(1, 20);
        $this->assertCount(20, Pagination::paginer($items));
    }

    public function testDecoupeSelonPageEtParPage(): void
    {
        $_GET = ['page' => '2', 'parPage' => '5'];
        $r = Pagination::paginer(range(1, 20));
        $this->assertCount(5, $r);
        $this->assertSame(6, $r[0]);  // page 2 → éléments 6..10
        $this->assertSame(10, $r[4]);
    }

    public function testBorneHauteParPage(): void
    {
        $_GET = ['page' => '1', 'parPage' => '9999'];
        $this->assertCount(100, Pagination::paginer(range(1, 500))); // plafonné à 100
    }
}
