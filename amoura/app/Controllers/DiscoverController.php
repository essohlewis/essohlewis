<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Models\Matching;
use Amoura\Models\Notification;
use Amoura\Models\Subscription;
use Amoura\Models\Swipe;

final class DiscoverController extends Controller
{
    private const FREE_DAILY_LIKES = 20;

    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];

        // Onboarding : étapes de complétion du profil (affichées tant que < 100 %).
        $profileModel = new \Amoura\Models\Profile();
        $profileModel->ensureExists($uid);
        $raw = $profileModel->find($uid) ?? [];
        $onboarding = [
            'completion' => (int) ($raw['completion'] ?? 0),
            'steps' => [
                ['done' => (new \Amoura\Models\Photo())->countForUser($uid) > 0, 'label' => t('onboard.add_photo'), 'url' => '/profile/edit'],
                ['done' => !empty($raw['bio']), 'label' => t('onboard.write_bio'), 'url' => '/profile/edit'],
                ['done' => !empty($raw['country']) || !empty($raw['city']), 'label' => t('onboard.set_prefs'), 'url' => '/profile/edit'],
                ['done' => (int) ($user['is_verified'] ?? 0) === 1, 'label' => t('onboard.verify'), 'url' => '/profile/edit'],
            ],
        ];

        $this->view('discover/index', [
            'admirers_count' => (new Swipe())->likesReceivedCount($uid),
            'is_premium' => (new Subscription())->activeFor($uid) !== null,
            'onboarding' => $onboarding,
        ]);
    }

    /** Renvoie une page de profils candidats (JSON) selon les filtres. */
    public function feed(Request $request): void
    {
        $user = $this->requireAuth($request);
        $filters = [
            'gender' => $request->query('gender'),
            'country' => $request->query('country'),
            'city' => $request->query('city'),
            'min_age' => $request->query('min_age'),
            'max_age' => $request->query('max_age'),
            'distance_km' => $request->query('distance_km'),
            'lat' => $request->query('lat'),
            'lng' => $request->query('lng'),
            'smoking' => $request->query('smoking'),
            'drinking' => $request->query('drinking'),
            'children' => $request->query('children'),
            'relationship_goal' => $request->query('relationship_goal'),
        ];
        // On récupère un vivier élargi puis on le reclasse par affinité (Phase 2).
        $profiles = (new Matching())->discover(
            (int) $user['id'],
            array_filter($filters, fn($v) => $v !== null && $v !== ''),
            60
        );

        // Enrichissement d'affichage (âge, avatar, intérêts décodés).
        $profiles = array_map(function ($p) {
            $p['age'] = age_from($p['birthdate'] ?? null);
            $p['avatar'] = avatar_url($p['avatar_path'] ?? null);
            $p['interests'] = json_decode($p['interests'] ?? '[]', true) ?: [];
            unset($p['birthdate']);
            return $p;
        }, $profiles);

        // Profil de l'observateur pour le calcul d'affinité.
        $me = (new \Amoura\Models\User())->fullProfile((int) $user['id']) ?? [];
        $viewer = [
            'interests' => json_decode($me['interests'] ?? '[]', true) ?: [],
            'city' => $me['city'] ?? null,
            'country' => $me['country'] ?? null,
            'age' => age_from($me['birthdate'] ?? null),
        ];

        $ranked = \Amoura\Services\Recommender::rank($viewer, $profiles);
        // Reclassement personnalisé par apprentissage implicite (Phase 6).
        $ranked = \Amoura\Services\Matching\PersonalizedRanker::rerank((int) $user['id'], $ranked);
        $this->json(['ok' => true, 'profiles' => array_slice($ranked, 0, 20)]);
    }

    /** Enregistre un like/pass et gère le quota + la détection de match. */
    public function swipe(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        $targetId = (int) $request->input('target_id');
        $action = (string) $request->input('action');

        if (!in_array($action, ['like', 'pass', 'superlike'], true) || $targetId <= 0) {
            $this->json(['ok' => false, 'error' => 'Action invalide.'], 422);
        }

        // Super Like : consomme un crédit (achat à l'unité) de façon atomique.
        if ($action === 'superlike') {
            if (!(new \Amoura\Models\Credit())->consume($uid, 'superlike')) {
                $this->json([
                    'ok' => false,
                    'error' => 'Aucun Super Like disponible.',
                    'store' => true,
                ], 402);
            }
        }

        // Quota de likes pour les comptes gratuits.
        $subs = new Subscription();
        $unlimited = $subs->hasFeature($uid, 'unlimited_likes');
        if (!$unlimited && $action === 'like') {
            $today = (new Swipe())->likesTodayCount($uid);
            if ($today >= self::FREE_DAILY_LIKES) {
                $this->json([
                    'ok' => false,
                    'error' => 'Limite quotidienne de likes atteinte.',
                    'upgrade' => true,
                ], 402);
            }
        }

        $result = (new Swipe())->act($uid, $targetId, $action);

        // Notifications temps réel : like reçu + match mutuel.
        $notif = new Notification();
        if ($action !== 'pass') {
            $notif->push($targetId, $action === 'superlike' ? 'superlike' : 'like', $uid);
        }
        if ($result['matched']) {
            $notif->push($targetId, 'match', $uid, ['conversation_id' => $result['conversation_id']]);
            $notif->push($uid, 'match', $targetId, ['conversation_id' => $result['conversation_id']]);
        }

        $this->json([
            'ok' => true,
            'matched' => $result['matched'],
            'conversation_id' => $result['conversation_id'],
        ]);
    }

    public function admirers(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        // Débloqué par un abonnement Premium OU par un crédit « révéler » actif (24 h).
        $revealed = !empty($user['reveal_until']) && strtotime($user['reveal_until']) > time();
        $isPremium = $revealed || (new Subscription())->hasFeature($uid, 'see_who_liked');
        $admirers = (new Swipe())->admirers($uid);
        foreach ($admirers as &$a) {
            $a['age'] = age_from($a['birthdate'] ?? null);
            $a['avatar'] = avatar_url($a['avatar_path'] ?? null);
        }
        $this->view('discover/admirers', [
            'admirers' => $admirers,
            'is_premium' => $isPremium,
        ]);
    }
}
