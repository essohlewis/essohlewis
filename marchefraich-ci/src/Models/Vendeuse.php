<?php

declare(strict_types=1);

namespace App\Models;

class Vendeuse extends Model
{
    /** Vendeuses validées d'un marché, avec le nombre de produits actifs. */
    public function valideesParMarche(int $marcheId): array
    {
        $stmt = $this->db->prepare(
            'SELECT v.*, COUNT(p.id) AS nb_produits
               FROM vendeuses v
          LEFT JOIN produits p ON p.vendeuse_id = v.id AND p.actif = 1
              WHERE v.marche_id = ? AND v.statut = "validee"
           GROUP BY v.id
           ORDER BY v.nom'
        );
        $stmt->execute([$marcheId]);
        return $stmt->fetchAll();
    }

    /** @return array<int,array<string,mixed>> Toutes les vendeuses (admin). */
    public function toutes(): array
    {
        return $this->db->query(
            'SELECT v.*, m.nom AS marche_nom
               FROM vendeuses v
               JOIN marches m ON m.id = v.marche_id
           ORDER BY v.cree_le DESC'
        )->fetchAll();
    }

    public function trouver(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT v.*, m.nom AS marche_nom FROM vendeuses v
               JOIN marches m ON m.id = v.marche_id WHERE v.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function parTelephone(string $telephone): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM vendeuses WHERE telephone = ?');
        $stmt->execute([$telephone]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Inscription simplifiée d'une vendeuse.
     * @return int Identifiant créé
     */
    public function creer(array $d): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO vendeuses (marche_id, nom, telephone, mot_de_passe, photo_etal, description)
             VALUES (:marche_id, :nom, :telephone, :mot_de_passe, :photo_etal, :description)'
        );
        $stmt->execute([
            ':marche_id'    => $d['marche_id'],
            ':nom'          => $d['nom'],
            ':telephone'    => $d['telephone'],
            ':mot_de_passe' => password_hash($d['mot_de_passe'], PASSWORD_DEFAULT),
            ':photo_etal'   => $d['photo_etal'] ?? null,
            ':description'  => $d['description'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function definirStatut(int $id, string $statut): void
    {
        $stmt = $this->db->prepare('UPDATE vendeuses SET statut = ? WHERE id = ?');
        $stmt->execute([$statut, $id]);
    }

    public function enregistrerPhoto(int $id, string $chemin): void
    {
        $stmt = $this->db->prepare('UPDATE vendeuses SET photo_etal = ? WHERE id = ?');
        $stmt->execute([$chemin, $id]);
    }
}
