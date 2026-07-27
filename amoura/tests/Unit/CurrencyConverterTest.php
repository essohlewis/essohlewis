<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Money\CurrencyConverter;
use PHPUnit\Framework\TestCase;

/** Conversion et formatage multi-devises (Phase 5, Sprint +16). */
final class CurrencyConverterTest extends TestCase
{
    private array $rates = ['XOF' => 1.0, 'EUR' => 0.0015245, 'USD' => 0.00165];

    public function testConvertsFromBase(): void
    {
        // 3500 XOF → EUR au taux fourni.
        $eur = CurrencyConverter::convert(3500, 'XOF', 'EUR', $this->rates);
        $this->assertEqualsWithDelta(5.336, $eur, 0.01);
    }

    public function testRoundTripIsStable(): void
    {
        $eur = CurrencyConverter::convert(3500, 'XOF', 'EUR', $this->rates);
        $back = CurrencyConverter::convert($eur, 'EUR', 'XOF', $this->rates);
        $this->assertEqualsWithDelta(3500.0, $back, 0.01);
    }

    public function testSameCurrencyUnchanged(): void
    {
        $this->assertSame(3500.0, CurrencyConverter::convert(3500, 'XOF', 'XOF', $this->rates));
    }

    public function testUnknownCurrencyPassesThrough(): void
    {
        $this->assertSame(3500.0, CurrencyConverter::convert(3500, 'XOF', 'ZZZ', $this->rates));
        $this->assertSame(3500.0, CurrencyConverter::convert(3500, 'ZZZ', 'EUR', $this->rates));
    }

    public function testFormatSymbolBefore(): void
    {
        $this->assertSame('€ 1 234,50',
            CurrencyConverter::format(1234.5, ['symbol' => '€', 'decimals' => 2, 'symbol_before' => 1]));
    }

    public function testFormatSymbolAfterNoDecimals(): void
    {
        $this->assertSame('3 500 FCFA',
            CurrencyConverter::format(3500, ['symbol' => 'FCFA', 'decimals' => 0, 'symbol_before' => 0]));
    }
}
