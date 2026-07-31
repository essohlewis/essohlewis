<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

/**
 * Modèle Opérateur (Orange, MTN, Moov).
 */
final class Operateur extends Model
{
    protected string $table = 'operateurs';

    /**
     * Retourne tous les opérateurs actifs.
     *
     * @return array<int, array<string, mixed>>
     */
    public function actifs(): array
    {
        $stmt = $this->db->query(
            'SELECT * FROM operateurs WHERE actif = 1 ORDER BY nom ASC'
        );
        return $stmt->fetchAll();
    }

    /**
     * Retourne un opérateur par son slug.
     *
     * @return array<string, mixed>|null
     */
    public function findBySlug(string $slug): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM operateurs WHERE slug = :slug LIMIT 1');
        $stmt->execute(['slug' => $slug]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Indexe les opérateurs par slug (utile pour les jointures côté vue).
     *
     * @return array<string, array<string, mixed>>
     */
    public function bySlug(): array
    {
        $result = [];
        foreach ($this->actifs() as $op) {
            $result[$op['slug']] = $op;
        }
        return $result;
    }
}
