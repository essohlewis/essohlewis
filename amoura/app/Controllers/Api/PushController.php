<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Models\PushSubscription;
use Amoura\Models\Setting;

/** Endpoints d'abonnement aux notifications Web Push. */
final class PushController extends Controller
{
    /** Clé publique VAPID nécessaire côté navigateur pour s'abonner. */
    public function publicKey(Request $request): void
    {
        $this->requireAuth($request);
        $key = (string) (new Setting())->get('vapid_public_key', '');
        $this->json(['ok' => true, 'key' => $key, 'enabled' => $key !== '']);
    }

    public function subscribe(Request $request): void
    {
        $user = $this->requireAuth($request);
        $data = $request->all();
        $endpoint = (string) ($data['endpoint'] ?? '');
        $keys = (array) ($data['keys'] ?? []);
        $p256dh = (string) ($keys['p256dh'] ?? '');
        $auth = (string) ($keys['auth'] ?? '');

        if ($endpoint === '' || $p256dh === '' || $auth === '' || !filter_var($endpoint, FILTER_VALIDATE_URL)) {
            $this->json(['ok' => false, 'error' => 'Abonnement invalide.'], 422);
        }

        (new PushSubscription())->store(
            (int) $user['id'], $endpoint, $p256dh, $auth, $request->userAgent()
        );
        $this->json(['ok' => true]);
    }

    public function unsubscribe(Request $request): void
    {
        $this->requireAuth($request);
        $endpoint = (string) $request->input('endpoint');
        if ($endpoint !== '') {
            (new PushSubscription())->deleteByEndpoint($endpoint);
        }
        $this->json(['ok' => true]);
    }
}
