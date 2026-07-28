<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Controllers\PwaController;
use PHPUnit\Framework\TestCase;

/**
 * Manifeste PWA (Phase 5, Sprint +22) : le manifeste est construit à partir des
 * réglages CMS. On vérifie la structure conforme, l'injection du nom et de la
 * couleur de marque, et la robustesse face à des valeurs invalides.
 */
final class PwaManifestTest extends TestCase
{
    /** @return array{site_name:string,description:string,primary_color:string} */
    private static function settings(string $name = 'Amoura', string $color = '#ff5a7e'): array
    {
        return ['site_name' => $name, 'description' => 'Desc', 'primary_color' => $color];
    }

    public function testManifestHasRequiredInstallableFields(): void
    {
        $m = PwaController::build(self::settings());

        $this->assertSame('standalone', $m['display']);
        $this->assertSame('/app', $m['start_url']);
        $this->assertSame('/', $m['scope']);
        $this->assertNotEmpty($m['icons']);
        // Au moins une icône maskable 512px pour un rendu natif propre.
        $has512 = false;
        foreach ($m['icons'] as $icon) {
            if (($icon['sizes'] ?? '') === '512x512' && str_contains((string) ($icon['purpose'] ?? ''), 'maskable')) {
                $has512 = true;
            }
        }
        $this->assertTrue($has512, 'Icône maskable 512x512 requise pour l\'installation.');
    }

    public function testNameAndShortNameComeFromSettings(): void
    {
        $m = PwaController::build(self::settings('Cupidon'));
        $this->assertSame('Cupidon — Rencontres', $m['name']);
        $this->assertSame('Cupidon', $m['short_name']);
    }

    public function testThemeColorComesFromSettings(): void
    {
        $this->assertSame('#8b5cf6', PwaController::build(self::settings('X', '#8b5cf6'))['theme_color']);
        // Forme courte #RGB acceptée.
        $this->assertSame('#f0a', PwaController::build(self::settings('X', '#f0a'))['theme_color']);
    }

    public function testInvalidColorFallsBackToBrand(): void
    {
        $this->assertSame('#ff5a7e', PwaController::build(self::settings('X', 'red'))['theme_color']);
        $this->assertSame('#ff5a7e', PwaController::build(self::settings('X', 'javascript:alert(1)'))['theme_color']);
        $this->assertSame('#ff5a7e', PwaController::build(self::settings('X', ''))['theme_color']);
    }

    public function testEmptyNameFallsBackToAmoura(): void
    {
        $m = PwaController::build(self::settings(''));
        $this->assertSame('Amoura', $m['short_name']);
    }

    public function testShortcutsPointToKeyDestinations(): void
    {
        $urls = array_column(PwaController::build(self::settings())['shortcuts'], 'url');
        $this->assertContains('/app', $urls);
        $this->assertContains('/messages', $urls);
        $this->assertContains('/store', $urls);
    }
}
