<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class ReadingProgress extends Model
{
    protected string $table = 'reading_progress';

    /** @return array<int,array<string,mixed>> */
    public function forChild(int $childId): array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM reading_progress WHERE child_id = ? ORDER BY last_read_at DESC'
        );
        $stmt->execute([$childId]);
        return $stmt->fetchAll();
    }

    /**
     * Upsert de la progression avec résolution last-write-wins sur last_read_at.
     * @param array<string,mixed> $data
     */
    public function upsert(int $childId, int $taleId, array $data): void
    {
        $level     = $data['level'] ?? 'N2';
        $lastPage  = (int) ($data['last_page'] ?? 0);
        $completed = !empty($data['completed']) ? 1 : 0;
        $quizScore = isset($data['quiz_score']) ? (int) $data['quiz_score'] : null;
        $lastRead  = $data['last_read_at'] ?? date('Y-m-d H:i:s');

        $stmt = $this->db()->prepare(
            'INSERT INTO reading_progress
                (child_id, tale_id, level, last_page, completed, completed_count, quiz_score, last_read_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                level           = VALUES(level),
                last_page       = GREATEST(last_page, VALUES(last_page)),
                completed       = GREATEST(completed, VALUES(completed)),
                completed_count = completed_count + IF(VALUES(completed) = 1 AND completed = 0, 1, 0),
                quiz_score      = COALESCE(VALUES(quiz_score), quiz_score),
                last_read_at    = GREATEST(last_read_at, VALUES(last_read_at))'
        );
        $stmt->execute([
            $childId, $taleId, $level, $lastPage, $completed,
            $completed, $quizScore, $lastRead,
        ]);
    }
}
