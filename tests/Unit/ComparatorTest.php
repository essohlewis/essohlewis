<?php

declare(strict_types=1);

namespace Transouscris\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use Transouscris\Controllers\ComparatorController;

/**
 * Vérifie la conversion volume→Go utilisée pour calculer le coût par Go du
 * comparateur (logique pure, sans base de données).
 */
final class ComparatorTest extends TestCase
{
    private function toGo(string $volume): float
    {
        $m = new ReflectionMethod(ComparatorController::class, 'toGigabytes');
        $m->setAccessible(true);
        return round($m->invoke(new ComparatorController(), $volume), 3);
    }

    public function test_convertit_les_gigaoctets(): void
    {
        $this->assertSame(1.0, $this->toGo('1 Go'));
        $this->assertSame(40.0, $this->toGo('40 Go'));
    }

    public function test_convertit_les_megaoctets(): void
    {
        $this->assertSame(0.488, $this->toGo('500 Mo'));
    }

    public function test_gere_la_virgule_decimale(): void
    {
        $this->assertSame(1.5, $this->toGo('1,5 Go'));
    }

    public function test_illimite_non_chiffrable(): void
    {
        $this->assertSame(0.0, $this->toGo('Illimité'));
        $this->assertSame(0.0, $this->toGo('n/a'));
    }
}
