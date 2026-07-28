<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Models\Setting;

/**
 * Manifeste PWA piloté par le CMS. Le manifeste est généré dynamiquement à
 * partir des réglages (nom du site, couleur de marque) plutôt que servi comme
 * fichier statique : renommer la plateforme ou changer sa couleur depuis
 * l'admin met à jour l'application installable sans redéploiement.
 *
 * Servi à /manifest.webmanifest (le fichier statique a été retiré pour que la
 * route prenne le relais aussi bien sous Apache que sous le serveur intégré).
 */
final class PwaController extends Controller
{
    public function manifest(Request $request): void
    {
        $s = new Setting();
        $data = self::build([
            'site_name'     => (string) $s->get('site_name', 'Amoura'),
            'description'   => (string) $s->get('site_description',
                'Rencontrez la bonne personne : chat, appels vidéo, statuts et plus.'),
            'primary_color' => (string) $s->get('primary_color', '#ff5a7e'),
        ]);

        header('Content-Type: application/manifest+json; charset=utf-8');
        // Le manifeste peut être mis en cache mais doit rester rafraîchissable
        // après un changement de réglage : cache court côté client.
        header('Cache-Control: public, max-age=3600');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        exit;
    }

    /**
     * Construit la structure du manifeste à partir des réglages.
     * Méthode pure (sans I/O) pour rester testable.
     *
     * @param array{site_name:string,description:string,primary_color:string} $settings
     * @return array<string,mixed>
     */
    public static function build(array $settings): array
    {
        $name = $settings['site_name'] !== '' ? $settings['site_name'] : 'Amoura';
        $color = self::normalizeColor($settings['primary_color']);

        return [
            'name'             => $name . ' — Rencontres',
            'short_name'       => $name,
            'description'      => $settings['description'],
            'start_url'        => '/app',
            'scope'            => '/',
            'display'          => 'standalone',
            'orientation'      => 'portrait',
            'background_color' => '#fbfafc',
            'theme_color'      => $color,
            'lang'             => 'fr',
            'dir'              => 'ltr',
            'categories'       => ['social', 'lifestyle'],
            'icons'            => [
                ['src' => '/assets/img/logo.svg', 'sizes' => 'any', 'type' => 'image/svg+xml', 'purpose' => 'any'],
                ['src' => '/assets/img/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
                ['src' => '/assets/img/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
            ],
            // Raccourcis d'application (appui long sur l'icône installée).
            'shortcuts'        => [
                [
                    'name'       => 'Découverte',
                    'short_name' => 'Découvrir',
                    'url'        => '/app',
                    'icons'      => [['src' => '/assets/img/icon-192.png', 'sizes' => '192x192']],
                ],
                [
                    'name'       => 'Messages',
                    'short_name' => 'Messages',
                    'url'        => '/messages',
                    'icons'      => [['src' => '/assets/img/icon-192.png', 'sizes' => '192x192']],
                ],
                [
                    'name'       => 'Boutique',
                    'short_name' => 'Boutique',
                    'url'        => '/store',
                    'icons'      => [['src' => '/assets/img/icon-192.png', 'sizes' => '192x192']],
                ],
            ],
        ];
    }

    /** Valide une couleur hexadécimale (#RGB ou #RRGGBB), repli sur la couleur de marque. */
    private static function normalizeColor(string $color): string
    {
        return preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $color) === 1 ? $color : '#ff5a7e';
    }
}
