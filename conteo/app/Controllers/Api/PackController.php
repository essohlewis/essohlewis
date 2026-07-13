<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Models\Pack;
use App\Models\Tale;
use App\Models\TaleAudio;
use App\Services\EntitlementService;
use App\Services\ManifestService;

final class PackController extends Controller
{
    public function __construct(
        private Pack $packs = new Pack(),
        private Tale $tales = new Tale(),
        private TaleAudio $audio = new TaleAudio(),
        private EntitlementService $entitlements = new EntitlementService(),
    ) {
    }

    /** GET /api/v1/packs (auth) */
    public function index(Request $request): void
    {
        $unlocked = $this->entitlements->unlockedPackIds($this->userId());
        $hasSub = $this->entitlements->hasActiveSubscription($this->userId());
        $out = [];
        foreach ($this->packs->active() as $p) {
            $out[] = [
                'id'            => (int) $p['id'],
                'slug'          => $p['slug'],
                'title'         => $p['title'],
                'description'   => $p['description'],
                'cover'         => $p['cover_url'],
                'price_fcfa'    => (int) $p['price_fcfa'],
                'tale_count'    => (int) $p['tale_count'],
                'total_size_mb' => (int) $p['total_size_mb'],
                'owned'         => $hasSub || in_array((int) $p['id'], $unlocked, true),
            ];
        }
        Response::ok(['packs' => $out]);
    }

    /**
     * GET /api/v1/packs/{slug}/download (auth)
     * Liste des assets à mettre en cache pour un usage hors-ligne.
     * Requiert que l'utilisateur possède le pack (ou un abonnement actif).
     */
    public function download(Request $request): void
    {
        $slug = (string) $request->param('slug');
        $pack = $this->packs->findBySlug($slug);
        if ($pack === null) {
            Response::error('Pack introuvable.', 404);
            return;
        }

        $userId = $this->userId();
        $owned = $this->entitlements->hasActiveSubscription($userId)
            || in_array((int) $pack['id'], $this->entitlements->unlockedPackIds($userId), true);

        if (!$owned) {
            Response::error('Pack non débloqué.', 403);
            return;
        }

        $manifestService = new ManifestService();
        $assets = [];
        $bytesEstimate = 0;

        foreach ($this->packs->tales((int) $pack['id']) as $tale) {
            $assets[] = $this->assetUrl($tale['cover_url']);
            $versions = $this->tales->versions((int) $tale['id']);
            foreach ($versions as $level => $version) {
                $assets[] = $this->assetUrl($version['manifest_url']);
                // Audio de toutes les langues disponibles pour la version.
                $tracks = $this->audio->langsForVersion((int) $version['id']);
                foreach ($tracks as $lang) {
                    $track = $this->audio->forVersionLang((int) $version['id'], $lang);
                    if ($track) {
                        $assets[] = $this->assetUrl($track['audio_url']);
                        $assets[] = $this->assetUrl($track['audio_url_fb']);
                        $assets[] = $this->assetUrl($track['timings_url']);
                        $bytesEstimate += (int) $track['file_size_kb'] * 1024;
                    }
                }
            }
        }

        Response::ok([
            'pack_id'         => (int) $pack['id'],
            'cache_name'      => 'conteo-pack-' . (int) $pack['id'],
            'assets'          => array_values(array_unique($assets)),
            'total_bytes_est' => $bytesEstimate,
        ]);
    }

    private function assetUrl(string $path): string
    {
        if (str_starts_with($path, 'http')) {
            return $path;
        }
        $config = require dirname(__DIR__, 3) . '/config/config.php';
        $base = $config['cdn']['base_url'] ?? '';
        return $base !== '' ? $base . '/' . ltrim($path, '/') : $path;
    }
}
