<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

/**
 * Modèle Catégorie de forfait (Internet, Appels, SMS, Pass réseaux, Mixte).
 */
final class CategorieForfait extends Model
{
    protected string $table = 'categories_forfait';

    /**
     * Toutes les catégories triées par ordre d'affichage.
     *
     * @return array<int, array<string, mixed>>
     */
    public function ordered(): array
    {
        return $this->db->query(
            'SELECT * FROM categories_forfait ORDER BY ordre ASC, nom ASC'
        )->fetchAll();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findBySlug(string $slug): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM categories_forfait WHERE slug = :slug LIMIT 1');
        $stmt->execute(['slug' => $slug]);
        return $stmt->fetch() ?: null;
    }
}
