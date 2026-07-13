<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class Pack extends Model
{
    protected string $table = 'packs';

    /** @return array<int,array<string,mixed>> */
    public function active(): array
    {
        $stmt = $this->db()->query('SELECT * FROM packs WHERE is_active = 1 ORDER BY id ASC');
        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function findBySlug(string $slug): ?array
    {
        return $this->findBy('slug', $slug);
    }

    /** Contes appartenant à un pack. @return array<int,array<string,mixed>> */
    public function tales(int $packId): array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM tales WHERE pack_id = ? ORDER BY sort_order ASC'
        );
        $stmt->execute([$packId]);
        return $stmt->fetchAll();
    }
}
