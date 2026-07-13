<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class TaleVersion extends Model
{
    protected string $table = 'tale_versions';

    /** @return array<string,mixed>|null */
    public function findByTaleLevel(int $taleId, string $level): ?array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM tale_versions WHERE tale_id = ? AND level = ? LIMIT 1'
        );
        $stmt->execute([$taleId, $level]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
