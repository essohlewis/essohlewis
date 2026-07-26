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
        $this->view('discover/index', [
            'admirers_count' => (new Swipe())->likesReceivedCount((int) $user['id']),
            'is_premium' => (new Subscription())->activeFor((int) $user['id']) !== null,
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
        ];
        $profiles = (new Matching())->discover((int) $user['id'], array_filter($filters, fn($v) => $v !== null && $v !== ''));

        // Enrichissement d'affichage (âge, avatar).
        $profiles = array_map(function ($p) {
            $p['age'] = age_from($p['birthdate'] ?? null);
            $p['avatar'] = avatar_url($p['avatar_path'] ?? null);
            $p['interests'] = json_decode($p['interests'] ?? '[]', true) ?: [];
            unset($p['birthdate']);
            return $p;
        }, $profiles);

        $this->json(['ok' => true, 'profiles' => $profiles]);
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

        // Quota de likes pour les comptes gratuits.
        $subs = new Subscription();
        $unlimited = $subs->hasFeature($uid, 'unlimited_likes');
        if (!$unlimited && $action !== 'pass') {
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
        $isPremium = (new Subscription())->hasFeature($uid, 'see_who_liked');
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
