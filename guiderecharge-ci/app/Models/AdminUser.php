<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

/**
 * Modèle Administrateur.
 *
 * Les mots de passe sont hachés en Argon2id. Aucune méthode ne renvoie
 * le hash en dehors du besoin d'authentification.
 */
final class AdminUser extends Model
{
    protected string $table = 'admin_users';

    /**
     * Retrouve un administrateur par email.
     *
     * @return array<string, mixed>|null
     */
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM admin_users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Crée un administrateur avec mot de passe haché Argon2id.
     */
    public function create(string $nom, string $email, string $password, string $role = 'admin'): int
    {
        return $this->insert([
            'nom'           => $nom,
            'email'         => $email,
            'password_hash' => password_hash($password, PASSWORD_ARGON2ID),
            'role'          => $role,
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
    }

    /** Met à jour le mot de passe (réhachage). */
    public function updatePassword(int $id, string $password): bool
    {
        $stmt = $this->db->prepare('UPDATE admin_users SET password_hash = :h WHERE id = :id');
        return $stmt->execute([
            'h'  => password_hash($password, PASSWORD_ARGON2ID),
            'id' => $id,
        ]);
    }
}
