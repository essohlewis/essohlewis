<?php

declare(strict_types=1);

namespace App\Models;

class Marche extends Model
{
    /** @return array<int,array<string,mixed>> */
    public function tousActifs(): array
    {
        return $this->db->query(
            'SELECT * FROM marches WHERE actif = 1 ORDER BY nom'
        )->fetchAll();
    }

    /** @return array<int,array<string,mixed>> */
    public function tous(): array
    {
        return $this->db->query('SELECT * FROM marches ORDER BY nom')->fetchAll();
    }

    public function trouver(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM marches WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function creer(string $nom, string $quartier, string $ville, string $adresse): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO marches (nom, quartier, ville, adresse) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$nom, $quartier, $ville, $adresse]);
        return (int) $this->db->lastInsertId();
    }

    public function basculerActif(int $id): void
    {
        $stmt = $this->db->prepare('UPDATE marches SET actif = 1 - actif WHERE id = ?');
        $stmt->execute([$id]);
    }
}
