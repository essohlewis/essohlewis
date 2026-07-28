<?php
declare(strict_types=1);

namespace Amoura\Controllers\Api;

use Amoura\Core\Paginator;
use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Models\Notification;

/**
 * Notifications pour les clients mobiles (jeton porteur) : liste paginée par
 * curseur, compteur de non-lus et marquage « tout lu ». Réutilise le modèle
 * Notification et la pagination par curseur du cœur.
 */
final class NotificationController extends ApiController
{
    private const PAGE = 30;

    /** Liste paginée (curseur opaque) des notifications, avec compteur non-lus. */
    public function list(Request $request): void
    {
        $this->requireAbility('notifications:read');
        $uid = (int) $this->user()['id'];
        $model = new Notification();

        $before = Paginator::decode($request->query('cursor'));
        $rows = $model->forUser($uid, self::PAGE, $before);
        $page = Paginator::page($rows, self::PAGE, static fn(array $n): int => (int) $n['id']);

        Response::ok([
            'notifications' => array_map([$this, 'project'], $page['data']),
            'unread'        => $model->unreadCount($uid),
            'next_cursor'   => $page['next_cursor'],
        ]);
    }

    /** Marque toutes les notifications comme lues. */
    public function read(Request $request): void
    {
        $this->requireAbility('notifications:write');
        (new Notification())->markAllRead((int) $this->user()['id']);
        Response::ok(['read' => true]);
    }

    /**
     * @param array<string,mixed> $n
     * @return array<string,mixed>
     */
    private function project(array $n): array
    {
        return [
            'id'          => (int) $n['id'],
            'type'        => $n['type'],
            'actor_id'    => isset($n['actor_id']) ? (int) $n['actor_id'] : null,
            'actor_name'  => $n['actor_name'] ?? null,
            'avatar'      => avatar_url($n['actor_avatar'] ?? null),
            'data'        => json_decode((string) ($n['data'] ?? '{}'), true) ?: [],
            'entity_type' => $n['entity_type'] ?? null,
            'entity_id'   => isset($n['entity_id']) ? (int) $n['entity_id'] : null,
            'is_read'     => ($n['read_at'] ?? null) !== null,
            'created_at'  => $n['created_at'] ?? null,
        ];
    }
}
