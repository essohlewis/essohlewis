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
        $limit = 30;
        $before = \Amoura\Core\Paginator::decode($request->query('cursor'));
        $rows = $model->forUser((int) $user['id'], $limit, $before);
        $page = \Amoura\Core\Paginator::page($rows, $limit, fn($n) => (int) $n['id']);

        $items = array_map(function ($n) {
            $n['avatar'] = avatar_url($n['actor_avatar'] ?? null);
            $n['ago'] = time_ago($n['created_at']);
            $n['data'] = json_decode($n['data'] ?? '{}', true) ?: [];
            return $n;
        }, $page['data']);

        $this->json([
            'ok' => true,
            'notifications' => $items,
            'unread' => $model->unreadCount((int) $user['id']),
            'next_cursor' => $page['next_cursor'],
        ]);
    }

    public function markRead(Request $request): void
    {
        $user = $this->requireAuth($request);
        (new Notification())->markAllRead((int) $user['id']);
        $this->json(['ok' => true]);
    }
}
