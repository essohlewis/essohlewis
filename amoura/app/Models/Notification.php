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

    /** Pagination par curseur : renvoie jusqu'à $limit+1 lignes (id < $beforeId). */
    public function forUser(int $userId, int $limit = 30, int $beforeId = 0): array
    {
        $cursor = $beforeId > 0 ? 'AND n.id < ?' : '';
        $params = [$userId];
        if ($beforeId > 0) {
            $params[] = $beforeId;
        }
        $params[] = $limit + 1; // +1 pour détecter la page suivante
        return $this->run(
            "SELECT n.*, actor.display_name AS actor_name, ph.path AS actor_avatar
             FROM notifications n
             LEFT JOIN users actor ON actor.id = n.actor_id
             LEFT JOIN profiles p ON p.user_id = actor.id
             LEFT JOIN photos ph ON ph.id = p.avatar_photo_id
             WHERE n.user_id = ? {$cursor} ORDER BY n.id DESC LIMIT ?",
            $params
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
