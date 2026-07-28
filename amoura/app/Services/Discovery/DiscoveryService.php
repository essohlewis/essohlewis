<?php
declare(strict_types=1);

namespace Amoura\Services\Discovery;

use Amoura\Models\Credit;
use Amoura\Models\Matching;
use Amoura\Models\Notification;
use Amoura\Models\Subscription;
use Amoura\Models\Swipe;
use Amoura\Models\User;
use Amoura\Services\Recommender;

/**
 * Logique métier de la découverte et du swipe, partagée entre l'application web
 * (DiscoverController) et l'API mobile (Api\DiscoverController) : un seul endroit
 * pour le vivier reclassé par affinité, le quota de likes gratuits, la
 * consommation de Super Like et la détection de match.
 */
final class DiscoveryService
{
    /** Likes quotidiens offerts aux comptes gratuits. */
    public const FREE_DAILY_LIKES = 20;

    /** Clés de filtres acceptées (les autres entrées sont ignorées). */
    private const FILTER_KEYS = [
        'gender', 'country', 'city', 'min_age', 'max_age', 'distance_km',
        'lat', 'lng', 'smoking', 'drinking', 'children', 'relationship_goal',
    ];

    /**
     * Vivier de profils candidats, reclassé par affinité pour l'observateur.
     *
     * @param array<string,mixed> $rawFilters
     * @return array<int,array<string,mixed>>
     */
    public function feed(int $uid, array $rawFilters, int $limit = 20): array
    {
        $filters = [];
        foreach (self::FILTER_KEYS as $k) {
            $v = $rawFilters[$k] ?? null;
            if ($v !== null && $v !== '') {
                $filters[$k] = $v;
            }
        }

        // Vivier élargi puis reclassé (on demande large pour laisser jouer l'affinité).
        $profiles = (new Matching())->discover($uid, $filters, 60);
        $profiles = array_map(static function (array $p): array {
            $p['age'] = age_from($p['birthdate'] ?? null);
            $p['avatar'] = avatar_url($p['avatar_path'] ?? null);
            $p['interests'] = json_decode($p['interests'] ?? '[]', true) ?: [];
            unset($p['birthdate']);
            return $p;
        }, $profiles);

        $me = (new User())->fullProfile($uid) ?? [];
        $viewer = [
            'interests' => json_decode($me['interests'] ?? '[]', true) ?: [],
            'city'      => $me['city'] ?? null,
            'country'   => $me['country'] ?? null,
            'age'       => age_from($me['birthdate'] ?? null),
        ];

        $ranked = Recommender::rank($viewer, $profiles);
        // Reclassement personnalisé par apprentissage implicite (Phase 6).
        $ranked = \Amoura\Services\Matching\PersonalizedRanker::rerank($uid, $ranked);
        return array_slice($ranked, 0, max(1, $limit));
    }

    /**
     * Enregistre un like/pass/superlike : valide l'action, applique le quota et
     * la consommation de crédit, détecte le match et pousse les notifications.
     *
     * @return array{ok:bool,status:int,error:?string,matched:bool,conversation_id:?int,flags:array<string,bool>}
     */
    public function swipe(int $uid, int $targetId, string $action): array
    {
        if (!in_array($action, ['like', 'pass', 'superlike'], true) || $targetId <= 0 || $targetId === $uid) {
            return self::fail(422, 'Action invalide.');
        }

        // Super Like : consomme un crédit de façon atomique.
        if ($action === 'superlike' && !(new Credit())->consume($uid, 'superlike')) {
            return self::fail(402, 'Aucun Super Like disponible.', ['store' => true]);
        }

        // Quota de likes pour les comptes gratuits.
        $subs = new Subscription();
        if ($action === 'like' && !$subs->hasFeature($uid, 'unlimited_likes')
            && (new Swipe())->likesTodayCount($uid) >= self::FREE_DAILY_LIKES) {
            return self::fail(402, 'Limite quotidienne de likes atteinte.', ['upgrade' => true]);
        }

        $result = (new Swipe())->act($uid, $targetId, $action);

        // Notifications : like/superlike reçu + match mutuel.
        $notif = new Notification();
        if ($action !== 'pass') {
            $notif->push($targetId, $action === 'superlike' ? 'superlike' : 'like', $uid);
        }
        if ($result['matched']) {
            $notif->push($targetId, 'match', $uid, ['conversation_id' => $result['conversation_id']]);
            $notif->push($uid, 'match', $targetId, ['conversation_id' => $result['conversation_id']]);
        }

        return [
            'ok'              => true,
            'status'          => 200,
            'error'           => null,
            'matched'         => (bool) $result['matched'],
            'conversation_id' => $result['conversation_id'],
            'flags'           => [],
        ];
    }

    /**
     * @param array<string,bool> $flags
     * @return array{ok:bool,status:int,error:string,matched:bool,conversation_id:null,flags:array<string,bool>}
     */
    private static function fail(int $status, string $error, array $flags = []): array
    {
        return [
            'ok'              => false,
            'status'          => $status,
            'error'           => $error,
            'matched'         => false,
            'conversation_id' => null,
            'flags'           => $flags,
        ];
    }
}
