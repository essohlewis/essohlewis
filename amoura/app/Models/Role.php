<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/**
 * Rôles RBAC. Sert surtout à résoudre l'identifiant d'un rôle par son slug, sans
 * dépendre d'un identifiant codé en dur — la colonne `users.role_id` a beau avoir
 * une valeur par défaut, celle-ci n'est valide que si la table `roles` a bien été
 * initialisée (seed). Ici on résout dynamiquement et on répare le rôle « membre »
 * s'il manque, pour qu'une inscription ne casse jamais sur une base incomplète.
 */
final class Role extends Model
{
    protected string $table = 'roles';

    /** Identifiant d'un rôle par son slug, ou null s'il n'existe pas. */
    public function idBySlug(string $slug): ?int
    {
        $row = $this->findBy('slug', $slug);
        return $row !== null ? (int) $row['id'] : null;
    }

    /**
     * Identifiant du rôle « membre » (celui de tout nouvel inscrit), créé s'il
     * est absent. Le rôle membre est minimal par définition : aucune permission,
     * pas d'accès à l'espace d'administration.
     */
    public function memberRoleId(): int
    {
        $id = $this->idBySlug('member');
        if ($id !== null) {
            return $id;
        }
        // Auto-réparation : la base n'a pas été seedée. On crée le rôle membre
        // (INSERT IGNORE : sans effet en cas de course sur la contrainte d'unicité).
        $this->run(
            "INSERT IGNORE INTO roles (slug, name, permissions, is_staff)
             VALUES ('member', 'Membre', JSON_ARRAY(), 0)"
        );
        return $this->idBySlug('member') ?? (int) $this->db->lastInsertId();
    }
}
