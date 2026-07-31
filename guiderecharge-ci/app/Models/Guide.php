<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

/**
 * Modèle Guide (procédures pas-à-pas, numéros utiles, réclamations).
 */
final class Guide extends Model
{
    protected string $table = 'guides';

    /**
     * Guides actifs, optionnellement filtrés par catégorie.
     *
     * @return array<int, array<string, mixed>>
     */
    public function actifs(?string $categorie = null): array
    {
        $sql = 'SELECT g.*, o.nom AS operateur_nom, o.slug AS operateur_slug, o.couleur_hex '
            . 'FROM guides g LEFT JOIN operateurs o ON o.id = g.operateur_id '
            . 'WHERE g.actif = 1 ';
        $params = [];
        if ($categorie !== null && $categorie !== '') {
            $sql .= 'AND g.categorie = :cat ';
            $params['cat'] = $categorie;
        }
        $sql .= 'ORDER BY g.created_at DESC';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Guide par slug (avec incrément des vues optionnel).
     *
     * @return array<string, mixed>|null
     */
    public function findBySlug(string $slug): ?array
    {
        $sql = 'SELECT g.*, o.nom AS operateur_nom, o.slug AS operateur_slug, o.couleur_hex '
            . 'FROM guides g LEFT JOIN operateurs o ON o.id = g.operateur_id '
            . 'WHERE g.slug = :slug AND g.actif = 1 LIMIT 1';
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['slug' => $slug]);
        return $stmt->fetch() ?: null;
    }

    /** Incrémente le compteur de vues d'un guide. */
    public function incrementVues(int $id): void
    {
        $stmt = $this->db->prepare('UPDATE guides SET vues = vues + 1 WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    /**
     * Recherche plein texte titre/contenu.
     *
     * @return array<int, array<string, mixed>>
     */
    public function search(string $term, int $limit = 20): array
    {
        $limit = max(1, min(50, $limit));
        $sql = 'SELECT g.* FROM guides g '
            . 'WHERE g.actif = 1 AND (g.titre LIKE :t1 OR g.contenu LIKE :t2) '
            . 'ORDER BY g.vues DESC LIMIT ' . $limit;
        $stmt = $this->db->prepare($sql);
        $like = '%' . $term . '%';
        $stmt->execute(['t1' => $like, 't2' => $like]);
        return $stmt->fetchAll();
    }

    /**
     * Distinct des catégories de guides existantes.
     *
     * @return array<int, string>
     */
    public function categories(): array
    {
        $rows = $this->db->query(
            'SELECT DISTINCT categorie FROM guides WHERE actif = 1 AND categorie <> "" ORDER BY categorie ASC'
        )->fetchAll();
        return array_column($rows, 'categorie');
    }

    /**
     * Tous les guides pour l'admin.
     *
     * @return array<int, array<string, mixed>>
     */
    public function allAdmin(): array
    {
        $sql = 'SELECT g.*, o.nom AS operateur_nom FROM guides g '
            . 'LEFT JOIN operateurs o ON o.id = g.operateur_id '
            . 'ORDER BY g.created_at DESC';
        return $this->db->query($sql)->fetchAll();
    }
}
