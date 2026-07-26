<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Core\I18n;
use PHPUnit\Framework\TestCase;

final class I18nTest extends TestCase
{
    protected function tearDown(): void
    {
        I18n::setLocale('fr'); // remet la locale par défaut entre les tests
    }

    public function testTranslatesKnownKeyPerLocale(): void
    {
        I18n::setLocale('fr');
        $this->assertSame('Découvrir', I18n::t('nav.discover'));
        I18n::setLocale('en');
        $this->assertSame('Discover', I18n::t('nav.discover'));
    }

    public function testFallsBackToKeyWhenMissing(): void
    {
        I18n::setLocale('en');
        $this->assertSame('nav.inexistant', I18n::t('nav.inexistant'));
    }

    public function testUnknownLocaleFallsBackToDefault(): void
    {
        I18n::setLocale('xx');
        $this->assertSame('fr', I18n::locale());
    }

    public function testVariableSubstitution(): void
    {
        I18n::setLocale('en');
        $this->assertSame('3 view(s)', I18n::t('visitors.count', ['n' => 3]));
        $this->assertSame('Profile 80% complete', I18n::t('onboard.done', ['percent' => 80]));
    }

    public function testAvailableLocales(): void
    {
        $this->assertSame(['fr', 'en'], I18n::available());
        $this->assertTrue(I18n::isAvailable('en'));
        $this->assertFalse(I18n::isAvailable('de'));
    }
}
