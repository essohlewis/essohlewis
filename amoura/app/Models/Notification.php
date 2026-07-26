<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Notification extends Model
{
    protected string $table = 'notifications';

    public function push(int $userId, string $type, ?int $actorId = null, array $data = [], ?string $entityType = null, ?int $entityId = null): int
    {
        return $this->create([
            'user_id' => $userId,
            'actor_id' => $actorId,
            'type' => $type,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'data' => $data ? json_encode($data) : null,
        ]);
    }

    public function forUser(int $userId, int $limit = 30): array
    {
        return $this->run(
            'SELECT n.*, actor.display_name AS actor_name, ph.path AS actor_avatar
             FROM notifications n
             LEFT JOIN users actor ON actor.id = n.actor_id
             LEFT JOIN profiles p ON p.user_id = actor.id
             LEFT JOIN photos ph ON ph.id = p.avatar_photo_id
             WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ?',
            [$userId, $limit]
        )->fetchAll();
    }

    public function unreadCount(int $userId): int
    {
        return (int) $this->run(
            'SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL',
            [$userId]
        )->fetchColumn();
    }

    public function markAllRead(int $userId): void
    {
        $this->run('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [$userId]);
    }
}
