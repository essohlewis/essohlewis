<?php

declare(strict_types=1);

namespace App\Models;

class Coursier extends Model
{
    public function parTelephone(string $telephone): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM coursiers WHERE telephone = ?');
        $stmt->execute([$telephone]);
        return $stmt->fetch() ?: null;
    }

    public function trouver(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM coursiers WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function tous(): array
    {
        return $this->db->query('SELECT * FROM coursiers ORDER BY nom')->fetchAll();
    }

    public function creer(array $d): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO coursiers (nom, telephone, mot_de_passe, zone)
             VALUES (:nom, :telephone, :mot_de_passe, :zone)'
        );
        $stmt->execute([
            ':nom'          => $d['nom'],
            ':telephone'    => $d['telephone'],
            ':mot_de_passe' => password_hash($d['mot_de_passe'], PASSWORD_DEFAULT),
            ':zone'         => $d['zone'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function definirDisponibilite(int $id, bool $disponible): void
    {
        $stmt = $this->db->prepare('UPDATE coursiers SET disponible = ? WHERE id = ?');
        $stmt->execute([$disponible ? 1 : 0, $id]);
    }
}
