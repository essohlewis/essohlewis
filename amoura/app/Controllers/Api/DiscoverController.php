<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Core\Security\Crypto;
use Amoura\Models\Matching;
use Amoura\Services\Discovery\DiscoveryService;

/**
 * Découverte & matching pour les clients mobiles (jeton porteur). Réutilise
 * DiscoveryService (même vivier reclassé par affinité, quota et détection de
 * match que le web) et projette des réponses JSON stables et versionnées.
 */
final class DiscoverController extends ApiController
{
    /** Fil de découverte reclassé par affinité (filtres en query). */
    public function feed(Request $request): void
    {
        $this->requireAbility('discover:read');
        $limit = max(1, min(50, (int) $request->query('limit', '20')));
        $profiles = (new DiscoveryService())->feed((int) $this->user()['id'], $request->all(), $limit);
        Response::ok(['profiles' => array_values($profiles)]);
    }

    /** Like / pass / superlike. Renseigner target_id et action. */
    public function swipe(Request $request): void
    {
        $this->requireAbility('discover:write');
        $result = (new DiscoveryService())->swipe(
            (int) $this->user()['id'],
            (int) $request->input('target_id'),
            (string) $request->input('action')
        );

        if (!$result['ok']) {
            Response::error((string) $result['error'], $result['status'], $result['flags']);
        }
        Response::ok([
            'matched'         => $result['matched'],
            'conversation_id' => $result['conversation_id'],
        ]);
    }

    /** Liste des matches de l'utilisateur (aperçu du dernier message déchiffré). */
    public function matches(Request $request): void
    {
        $this->requireAbility('matches:read');
        $rows = (new Matching())->forUser((int) $this->user()['id']);
        $matches = array_map(static function (array $m): array {
            $preview = $m['last_message'] !== null ? Crypto::decrypt((string) $m['last_message']) : null;
            return [
                'match_id'         => (int) $m['match_id'],
                'conversation_id'  => $m['conversation_id'] !== null ? (int) $m['conversation_id'] : null,
                'user_id'          => (int) $m['user_id'],
                'display_name'     => $m['display_name'],
                'avatar'           => avatar_url($m['avatar_path'] ?? null),
                'is_online'        => (bool) $m['is_online'],
                'is_verified'      => (bool) $m['is_verified'],
                'unread'           => (int) $m['unread'],
                'last_message'     => $preview !== null ? mb_substr($preview, 0, 140) : null,
                'last_message_at'  => $m['last_message_at'],
                'matched_at'       => $m['matched_at'],
            ];
        }, $rows);
        Response::ok(['matches' => $matches]);
    }

    /** Retire un match. */
    public function unmatch(Request $request, array $params): void
    {
        $this->requireAbility('matches:write');
        (new Matching())->unmatch((int) $this->user()['id'], (int) $params['id']);
        Response::ok(['unmatched' => true]);
    }
}
