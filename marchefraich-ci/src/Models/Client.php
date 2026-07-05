<?php

declare(strict_types=1);

namespace App\Models;

class Client extends Model
{
    public function parTelephone(string $telephone): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM clients WHERE telephone = ?');
        $stmt->execute([$telephone]);
        return $stmt->fetch() ?: null;
    }

    public function trouver(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM clients WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function creer(array $d): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO clients (nom, telephone, mot_de_passe, quartier, adresse)
             VALUES (:nom, :telephone, :mot_de_passe, :quartier, :adresse)'
        );
        $stmt->execute([
            ':nom'          => $d['nom'],
            ':telephone'    => $d['telephone'],
            ':mot_de_passe' => password_hash($d['mot_de_passe'], PASSWORD_DEFAULT),
            ':quartier'     => $d['quartier'] ?? null,
            ':adresse'      => $d['adresse'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }
}
