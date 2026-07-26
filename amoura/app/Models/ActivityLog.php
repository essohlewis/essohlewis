<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Journal d'audit des actions sensibles (staff & système). */
final class ActivityLog extends Model
{
    protected string $table = 'activity_logs';

    public function record(?int $userId, string $action, ?string $entityType = null, ?int $entityId = null, array $context = [], ?string $ip = null): void
    {
        $this->run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address, context)
             VALUES (?, ?, ?, ?, ?, ?)',
            [
                $userId,
                $action,
                $entityType,
                $entityId,
                $ip ? @inet_pton($ip) : null,
                $context ? json_encode($context) : null,
            ]
        );
    }

    public function recent(int $limit = 50, int $offset = 0): array
    {
        return $this->run(
            'SELECT l.*, u.display_name FROM activity_logs l
             LEFT JOIN users u ON u.id = l.user_id
             ORDER BY l.created_at DESC LIMIT ? OFFSET ?',
            [$limit, $offset]
        )->fetchAll();
    }
}
