<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Models\Tale;
use App\Services\EntitlementService;
use App\Services\ManifestService;

final class TaleController extends Controller
{
    public function __construct(
        private Tale $tales = new Tale(),
        private EntitlementService $entitlements = new EntitlementService(),
        private ManifestService $manifests = new ManifestService(),
    ) {
    }

    /** GET /api/v1/tales?level=N2&lang=fr (auth) — catalogue filtré + droits */
    public function index(Request $request): void
    {
        $level = $this->normalizeLevel((string) $request->query('level', ''));
        $userId = $this->userId();

        $rows = $this->tales->catalogue();
        $out = [];
        foreach ($rows as $tale) {
            // Ne renvoyer que les contes possédant la version au niveau demandé,
            // si un niveau est précisé.
            if ($level !== null) {
                $versions = $this->tales->versions((int) $tale['id']);
                if (!isset($versions[$level])) {
                    continue;
                }
            }
            $out[] = $this->presentCard($this->entitlements->decorate($userId, $tale));
        }

        Response::ok(['tales' => $out]);
    }

    /** GET /api/v1/tales/{slug}?level=N2&lang=fr (auth) — détail + manifest + audio */
    public function show(Request $request): void
    {
        $slug = (string) $request->param('slug');
        $tale = $this->tales->findBySlug($slug);
        if ($tale === null || $tale['published_at'] === null) {
            Response::error('Conte introuvable.', 404);
            return;
        }

        $userId = $this->userId();
        if (!$this->entitlements->canAccessTale($userId, $tale)) {
            Response::error('Conte verrouillé. Abonnement ou pack requis.', 403, [
                'reason' => ['premium'],
            ]);
            return;
        }

        $level = $this->normalizeLevel((string) $request->query('level', $tale['default_level'] ?? 'N2')) ?? 'N2';
        $lang  = preg_replace('/[^a-z]/', '', strtolower((string) $request->query('lang', 'fr'))) ?: 'fr';

        // Contrôle d'accès à la langue de narration.
        if (!$this->entitlements->canUseLang($userId, $lang, $tale)) {
            $lang = 'fr';
        }

        $detail = $this->manifests->buildDetail($tale, $level, $lang);
        if ($detail === null) {
            Response::error('Ce niveau n\'est pas disponible pour ce conte.', 404);
            return;
        }

        Response::ok($detail);
    }

    /** @param array<string,mixed> $t */
    private function presentCard(array $t): array
    {
        return [
            'id'       => (int) $t['id'],
            'slug'     => $t['slug'],
            'title'    => $t['title'],
            'origin'   => $t['origin'],
            'cover'    => $t['cover_url'],
            'is_free'  => (bool) $t['is_free'],
            'locked'   => (bool) ($t['locked'] ?? false),
            'pack_id'  => $t['pack_id'] !== null ? (int) $t['pack_id'] : null,
        ];
    }

    private function normalizeLevel(string $level): ?string
    {
        return in_array($level, ['N1', 'N2', 'N3'], true) ? $level : null;
    }
}
