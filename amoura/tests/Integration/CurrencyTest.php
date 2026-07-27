<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Currency;
use Amoura\Services\Money\CurrencyContext;

/** Devises : modèle + contexte d'affichage (Phase 5, Sprint +16). */
final class CurrencyTest extends IntegrationTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        CurrencyContext::reset();
        unset($_COOKIE['amoura_currency']);
    }

    protected function tearDown(): void
    {
        CurrencyContext::reset();
        unset($_COOKIE['amoura_currency']);
    }

    public function testActiveCurrenciesSeeded(): void
    {
        $all = (new Currency())->active();
        $this->assertGreaterThanOrEqual(6, count($all));
        $codes = array_column($all, 'code');
        $this->assertContains('XOF', $codes);
        $this->assertContains('EUR', $codes);

        $this->assertNotNull((new Currency())->find('eur'), 'recherche insensible à la casse');
        $this->assertNull((new Currency())->find('ZZZ'));
    }

    public function testDefaultsToBaseCurrencyWithoutCookie(): void
    {
        $this->assertSame('XOF', CurrencyContext::current());
        $display = CurrencyContext::display(350000); // 3500 XOF
        $this->assertStringContainsString('FCFA', $display);
        $this->assertStringStartsWith('3', $display, 'aucun préfixe ≈ pour la devise de base');
        $this->assertStringNotContainsString('≈', $display);
    }

    public function testConvertsAndMarksIndicativeForForeignCurrency(): void
    {
        $_COOKIE['amoura_currency'] = 'EUR';
        CurrencyContext::reset();

        $this->assertSame('EUR', CurrencyContext::current());
        $display = CurrencyContext::display(350000); // 3500 XOF → ~5,34 €
        $this->assertStringStartsWith('≈', $display, 'montant converti = indicatif');
        $this->assertStringContainsString('€', $display);
    }

    public function testInvalidCookieFallsBackToBase(): void
    {
        $_COOKIE['amoura_currency'] = 'ZZZ';
        CurrencyContext::reset();
        $this->assertSame('XOF', CurrencyContext::current());
        $this->assertFalse(CurrencyContext::isValid('ZZZ'));
        $this->assertTrue(CurrencyContext::isValid('usd'));
    }
}
