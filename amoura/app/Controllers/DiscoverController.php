<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Models\Subscription;
use Amoura\Models\Swipe;

final class DiscoverController extends Controller
{
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
        $profiles = (new \Amoura\Services\Discovery\DiscoveryService())
            ->feed((int) $user['id'], $request->all(), 20);
        $this->json(['ok' => true, 'profiles' => $profiles]);
    }

    /** Enregistre un like/pass et gère le quota + la détection de match. */
    public function swipe(Request $request): void
    {
        $user = $this->requireAuth($request);
        $result = (new \Amoura\Services\Discovery\DiscoveryService())->swipe(
            (int) $user['id'],
            (int) $request->input('target_id'),
            (string) $request->input('action')
        );

        if (!$result['ok']) {
            // On préserve les indices client existants (store / upgrade).
            $extra = [];
            if (!empty($result['flags']['store'])) {
                $extra['store'] = true;
            }
            if (!empty($result['flags']['upgrade'])) {
                $extra['upgrade'] = true;
            }
            $this->json(['ok' => false, 'error' => $result['error']] + $extra, $result['status']);
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
