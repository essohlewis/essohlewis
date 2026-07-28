<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Role;
use Amoura\Models\User;

/**
 * Résolution des rôles (correctif inscription) : le rôle d'un nouvel inscrit est
 * résolu par slug, jamais par un identifiant codé en dur, et le rôle « membre »
 * est recréé si la base n'a pas été correctement initialisée — sans quoi
 * l'inscription échouait sur la contrainte de clé étrangère `fk_users_role`.
 */
final class RoleTest extends IntegrationTestCase
{
    public function testMemberRoleResolvedBySlug(): void
    {
        $id = (new Role())->memberRoleId();
        $this->assertGreaterThan(0, $id);
        $row = (new Role())->findBy('slug', 'member');
        $this->assertSame($id, (int) $row['id']);
    }

    public function testMemberRoleSelfHealsWhenRolesMissing(): void
    {
        // Simule une base où le seed n'a pas peuplé les rôles.
        $this->db->exec('SET FOREIGN_KEY_CHECKS = 0');
        $this->db->exec('DELETE FROM roles');
        $this->db->exec('SET FOREIGN_KEY_CHECKS = 1');
        $this->assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM roles')->fetchColumn());

        $id = (new Role())->memberRoleId();
        $this->assertGreaterThan(0, $id);
        // Le rôle membre existe désormais et permet de créer un utilisateur
        // (la contrainte fk_users_role est satisfaite).
        $uid = (new User())->create([
            'role_id' => $id,
            'email' => 'heal@example.com',
            'password_hash' => 'x',
            'display_name' => 'Heal',
            'birthdate' => '1995-01-01',
            'gender' => 'other',
            'status' => 'pending',
        ]);
        $this->assertGreaterThan(0, $uid);
    }
}
