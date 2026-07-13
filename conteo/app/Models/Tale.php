<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class Tale extends Model
{
    protected string $table = 'tales';

    /**
     * Catalogue publié, optionnellement restreint aux contes gratuits.
     * @return array<int,array<string,mixed>>
     */
    public function catalogue(bool $freeOnly = false): array
    {
        $sql = 'SELECT * FROM tales WHERE published_at IS NOT NULL';
        if ($freeOnly) {
            $sql .= ' AND is_free = 1';
        }
        $sql .= ' ORDER BY sort_order ASC, id ASC';
        $stmt = $this->db()->query($sql);
        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function findBySlug(string $slug): ?array
    {
        return $this->findBy('slug', $slug);
    }

    /**
     * Versions (N1/N2/N3) d'un conte, indexées par niveau.
     * @return array<string,array<string,mixed>>
     */
    public function versions(int $taleId): array
    {
        $stmt = $this->db()->prepare('SELECT * FROM tale_versions WHERE tale_id = ?');
        $stmt->execute([$taleId]);
        $out = [];
        foreach ($stmt->fetchAll() as $v) {
            $out[$v['level']] = $v;
        }
        return $out;
    }
}
