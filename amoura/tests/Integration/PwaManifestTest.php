<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Controllers\PwaController;
use Amoura\Models\Setting;

/**
 * Manifeste PWA piloté par le CMS (Phase 5, Sprint +22) : un changement de nom
 * ou de couleur de marque depuis l'admin doit se refléter dans l'application
 * installable, sans redéploiement.
 */
final class PwaManifestTest extends IntegrationTestCase
{
    public function testManifestReflectsSiteNameSetting(): void
    {
        $s = new Setting();
        $s->set('site_name', 'Rencontres Abidjan');

        $m = PwaController::build([
            'site_name'     => (string) $s->get('site_name', 'Amoura'),
            'description'   => (string) $s->get('site_description', 'Desc'),
            'primary_color' => (string) $s->get('primary_color', '#ff5a7e'),
        ]);

        $this->assertSame('Rencontres Abidjan', $m['short_name']);
        $this->assertSame('Rencontres Abidjan — Rencontres', $m['name']);
    }

    public function testManifestUsesSeededBrandColor(): void
    {
        // La couleur primaire est semée à #ff5a7e ; le manifeste doit la reprendre.
        $primary = (string) (new Setting())->get('primary_color', '');
        $this->assertSame('#ff5a7e', $primary);

        $m = PwaController::build(['site_name' => 'Amoura', 'description' => 'D', 'primary_color' => $primary]);
        $this->assertSame('#ff5a7e', $m['theme_color']);
    }
}
