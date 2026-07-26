<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Models\Notification;

final class NotificationController extends Controller
{
    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $this->view('social/notifications', [
            'notifications' => (new Notification())->forUser((int) $user['id']),
        ]);
    }

    public function list(Request $request): void
    {
        $user = $this->requireAuth($request);
        $model = new Notification();
        $items = $model->forUser((int) $user['id']);
        foreach ($items as &$n) {
            $n['avatar'] = avatar_url($n['actor_avatar'] ?? null);
            $n['ago'] = time_ago($n['created_at']);
            $n['data'] = json_decode($n['data'] ?? '{}', true) ?: [];
        }
        $this->json(['ok' => true, 'notifications' => $items, 'unread' => $model->unreadCount((int) $user['id'])]);
    }

    public function markRead(Request $request): void
    {
        $user = $this->requireAuth($request);
        (new Notification())->markAllRead((int) $user['id']);
        $this->json(['ok' => true]);
    }
}
