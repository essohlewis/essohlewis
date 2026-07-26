<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Report extends Model
{
    protected string $table = 'reports';

    public function file(int $reporterId, string $targetType, int $targetId, string $reason, ?string $details): int
    {
        return $this->create([
            'reporter_id' => $reporterId,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'reason' => $reason,
            'details' => $details,
        ]);
    }

    public function queue(string $status = 'open', int $limit = 30): array
    {
        return $this->run(
            'SELECT r.*, reporter.display_name AS reporter_name
             FROM reports r JOIN users reporter ON reporter.id = r.reporter_id
             WHERE r.status = ? ORDER BY r.created_at ASC LIMIT ?',
            [$status, $limit]
        )->fetchAll();
    }

    public function resolve(int $reportId, int $staffId, string $status): void
    {
        $this->run(
            'UPDATE reports SET status = ?, handled_by = ?, handled_at = NOW() WHERE id = ?',
            [$status, $staffId, $reportId]
        );
    }

    public function openCount(): int
    {
        return (int) $this->run('SELECT COUNT(*) FROM reports WHERE status = "open"')->fetchColumn();
    }
}
