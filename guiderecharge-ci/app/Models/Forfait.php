<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

/**
 * Modèle Forfait.
 *
 * Fournit la récupération filtrée/triée des forfaits avec jointures sur
 * l'opérateur et la catégorie. Toutes les entrées de filtre passent par
 * des requêtes préparées et des listes blanches pour le tri.
 */
final class Forfait extends Model
{
    protected string $table = 'forfaits';

    /** Colonnes de tri autorisées (liste blanche anti-injection). */
    private const SORTS = [
        'prix_asc'    => 'f.prix ASC',
        'prix_desc'   => 'f.prix DESC',
        'populaire'   => 'f.populaire DESC, f.prix ASC',
        'recent'      => 'f.created_at DESC',
    ];

    /**
     * Requête SELECT de base avec jointures et libellés lisibles.
     */
    private function baseSelect(): string
    {
        return 'SELECT f.*, '
            . 'o.nom AS operateur_nom, o.slug AS operateur_slug, o.couleur_hex AS operateur_couleur, '
            . 'c.nom AS categorie_nom, c.slug AS categorie_slug, c.icone AS categorie_icone '
            . 'FROM forfaits f '
            . 'JOIN operateurs o ON o.id = f.operateur_id '
            . 'JOIN categories_forfait c ON c.id = f.categorie_id ';
    }

    /**
     * Retourne les forfaits selon un jeu de filtres.
     *
     * @param array{
     *   operateur?: string, categorie?: string, prix_min?: int,
     *   prix_max?: int, sort?: string, actif_only?: bool
     * } $filters
     * @return array<int, array<string, mixed>>
     */
    public function filter(array $filters = []): array
    {
        $where = [];
        $params = [];

        if (($filters['actif_only'] ?? true) === true) {
            $where[] = 'f.actif = 1';
        }

        if (!empty($filters['operateur'])) {
            $where[] = 'o.slug = :operateur';
            $params['operateur'] = $filters['operateur'];
        }
        if (!empty($filters['categorie'])) {
            $where[] = 'c.slug = :categorie';
            $params['categorie'] = $filters['categorie'];
        }
        if (isset($filters['prix_min']) && $filters['prix_min'] !== '') {
            $where[] = 'f.prix >= :prix_min';
            $params['prix_min'] = (int) $filters['prix_min'];
        }
        if (isset($filters['prix_max']) && $filters['prix_max'] !== '') {
            $where[] = 'f.prix <= :prix_max';
            $params['prix_max'] = (int) $filters['prix_max'];
        }

        $sql = $this->baseSelect();
        if ($where !== []) {
            $sql .= 'WHERE ' . implode(' AND ', $where) . ' ';
        }

        $sortKey = $filters['sort'] ?? 'populaire';
        $sql .= 'ORDER BY ' . (self::SORTS[$sortKey] ?? self::SORTS['populaire']);

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Forfaits populaires (badge « Populaire »), limités.
     *
     * @return array<int, array<string, mixed>>
     */
    public function populaires(int $limit = 6): array
    {
        $limit = max(1, min(50, $limit));
        $sql = $this->baseSelect()
            . 'WHERE f.actif = 1 AND f.populaire = 1 '
            . 'ORDER BY f.prix ASC LIMIT ' . $limit;
        return $this->db->query($sql)->fetchAll();
    }

    /**
     * Détail d'un forfait (avec jointures).
     *
     * @return array<string, mixed>|null
     */
    public function detail(int $id): ?array
    {
        $sql = $this->baseSelect() . 'WHERE f.id = :id LIMIT 1';
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Récupère plusieurs forfaits par une liste d'identifiants (comparateur).
     *
     * @param list<int> $ids
     * @return array<int, array<string, mixed>>
     */
    public function whereIn(array $ids): array
    {
        $ids = array_values(array_filter(array_map('intval', $ids)));
        if ($ids === []) {
            return [];
        }
        // Génère des placeholders positionnels sûrs (:id0, :id1, ...).
        $placeholders = [];
        $params = [];
        foreach ($ids as $i => $id) {
            $key = 'id' . $i;
            $placeholders[] = ':' . $key;
            $params[$key] = $id;
        }
        $sql = $this->baseSelect()
            . 'WHERE f.id IN (' . implode(', ', $placeholders) . ') AND f.actif = 1';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Recherche plein texte sur nom/description.
     *
     * @return array<int, array<string, mixed>>
     */
    public function search(string $term, int $limit = 20): array
    {
        $limit = max(1, min(50, $limit));
        $sql = $this->baseSelect()
            . 'WHERE f.actif = 1 AND (f.nom LIKE :t1 OR f.description LIKE :t2) '
            . 'ORDER BY f.populaire DESC, f.prix ASC LIMIT ' . $limit;
        $stmt = $this->db->prepare($sql);
        $like = '%' . $term . '%';
        $stmt->execute(['t1' => $like, 't2' => $like]);
        return $stmt->fetchAll();
    }

    /**
     * Forfaits les plus consultés (pour le dashboard admin).
     *
     * @return array<int, array<string, mixed>>
     */
    public function plusConsultes(int $limit = 5): array
    {
        $limit = max(1, min(20, $limit));
        $sql = $this->baseSelect()
            . 'ORDER BY f.vues DESC LIMIT ' . $limit;
        return $this->db->query($sql)->fetchAll();
    }

    /** Incrémente le compteur de vues d'un forfait. */
    public function incrementVues(int $id): void
    {
        $stmt = $this->db->prepare('UPDATE forfaits SET vues = vues + 1 WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    /**
     * Toutes les lignes pour l'admin (avec jointures, sans filtre actif).
     *
     * @return array<int, array<string, mixed>>
     */
    public function allAdmin(): array
    {
        $sql = $this->baseSelect() . 'ORDER BY o.nom ASC, f.prix ASC';
        return $this->db->query($sql)->fetchAll();
    }
}
