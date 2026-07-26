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

    /** File priorisée par gravité du motif puis ancienneté (Sprint +6). */
    public function queue(string $status = 'open', int $limit = 30): array
    {
        return $this->run(
            'SELECT r.*, reporter.display_name AS reporter_name,
                    CASE r.reason
                        WHEN "underage" THEN 0 WHEN "scam" THEN 1 WHEN "nudity" THEN 2
                        WHEN "harassment" THEN 3 WHEN "fake" THEN 4 ELSE 5 END AS severity
             FROM reports r JOIN users reporter ON reporter.id = r.reporter_id
             WHERE r.status = ? ORDER BY severity ASC, r.created_at ASC LIMIT ?',
            [$status, $limit]
        )->fetchAll();
    }

    /** Traitement groupé de plusieurs signalements. */
    public function bulkResolve(array $ids, int $staffId, string $status): int
    {
        $ids = array_values(array_filter(array_map('intval', $ids), fn($i) => $i > 0));
        if (!$ids) {
            return 0;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge([$status, $staffId], $ids);
        return $this->run(
            "UPDATE reports SET status = ?, handled_by = ?, handled_at = NOW()
             WHERE id IN ({$placeholders}) AND status = 'open'",
            $params
        )->rowCount();
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
