<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

/**
 * Modèle Code USSD générique.
 *
 * Représente les codes racines par opérateur et par action (achat crédit,
 * transfert, consultation solde, activation forfait) avec placeholders
 * {numero}, {montant}, {code}.
 */
final class CodeUssd extends Model
{
    protected string $table = 'codes_ussd';

    /**
     * Tous les codes d'un opérateur (par slug).
     *
     * @return array<int, array<string, mixed>>
     */
    public function forOperateur(string $slug): array
    {
        $sql = 'SELECT cu.* FROM codes_ussd cu '
            . 'JOIN operateurs o ON o.id = cu.operateur_id '
            . 'WHERE o.slug = :slug ORDER BY cu.action ASC';
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['slug' => $slug]);
        return $stmt->fetchAll();
    }

    /**
     * Retourne un code par opérateur (slug) + action.
     *
     * @return array<string, mixed>|null
     */
    public function byOperateurAction(string $slug, string $action): ?array
    {
        $sql = 'SELECT cu.* FROM codes_ussd cu '
            . 'JOIN operateurs o ON o.id = cu.operateur_id '
            . 'WHERE o.slug = :slug AND cu.action = :action LIMIT 1';
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['slug' => $slug, 'action' => $action]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Codes essentiels regroupés par opérateur, pour la page d'accueil.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function essentielsParOperateur(): array
    {
        $sql = 'SELECT cu.*, o.slug AS operateur_slug, o.nom AS operateur_nom, o.couleur_hex '
            . 'FROM codes_ussd cu JOIN operateurs o ON o.id = cu.operateur_id '
            . "WHERE cu.action IN ('achat_credit','transfert_credit','solde') "
            . 'ORDER BY o.nom ASC, cu.action ASC';
        $rows = $this->db->query($sql)->fetchAll();

        $grouped = [];
        foreach ($rows as $row) {
            $grouped[$row['operateur_slug']][] = $row;
        }
        return $grouped;
    }

    /**
     * Tous les codes pour l'admin (avec nom opérateur).
     *
     * @return array<int, array<string, mixed>>
     */
    public function allAdmin(): array
    {
        $sql = 'SELECT cu.*, o.nom AS operateur_nom, o.slug AS operateur_slug '
            . 'FROM codes_ussd cu JOIN operateurs o ON o.id = cu.operateur_id '
            . 'ORDER BY o.nom ASC, cu.action ASC';
        return $this->db->query($sql)->fetchAll();
    }

    /**
     * Recherche par libellé/pattern (recherche globale).
     *
     * @return array<int, array<string, mixed>>
     */
    public function search(string $term, int $limit = 20): array
    {
        $limit = max(1, min(50, $limit));
        $sql = 'SELECT cu.*, o.nom AS operateur_nom, o.slug AS operateur_slug '
            . 'FROM codes_ussd cu JOIN operateurs o ON o.id = cu.operateur_id '
            . 'WHERE cu.libelle LIKE :t1 OR cu.pattern LIKE :t2 '
            . 'ORDER BY o.nom ASC LIMIT ' . $limit;
        $stmt = $this->db->prepare($sql);
        $like = '%' . $term . '%';
        $stmt->execute(['t1' => $like, 't2' => $like]);
        return $stmt->fetchAll();
    }
}
