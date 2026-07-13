<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class ScreenSession extends Model
{
    protected string $table = 'screen_sessions';

    /** Incrémente le temps d'écran du jour (upsert). */
    public function addSeconds(int $childId, int $seconds): void
    {
        $stmt = $this->db()->prepare(
            'INSERT INTO screen_sessions (child_id, session_date, seconds_spent)
             VALUES (?, CURDATE(), ?)
             ON DUPLICATE KEY UPDATE seconds_spent = seconds_spent + VALUES(seconds_spent)'
        );
        $stmt->execute([$childId, max(0, $seconds)]);
    }

    public function secondsToday(int $childId): int
    {
        $stmt = $this->db()->prepare(
            'SELECT seconds_spent FROM screen_sessions
             WHERE child_id = ? AND session_date = CURDATE() LIMIT 1'
        );
        $stmt->execute([$childId]);
        return (int) ($stmt->fetchColumn() ?: 0);
    }

    /**
     * Historique des N derniers jours.
     * @return array<int,array{session_date:string,seconds_spent:int}>
     */
    public function history(int $childId, int $days = 7): array
    {
        $stmt = $this->db()->prepare(
            'SELECT session_date, seconds_spent FROM screen_sessions
             WHERE child_id = ? AND session_date >= (CURDATE() - INTERVAL ? DAY)
             ORDER BY session_date ASC'
        );
        $stmt->execute([$childId, $days]);
        return $stmt->fetchAll();
    }
}
