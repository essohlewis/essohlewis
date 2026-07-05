<?php

declare(strict_types=1);

namespace App\Models;

class Produit extends Model
{
    /** Produits actifs et en stock d'une vendeuse (vue client). */
    public function disponiblesParVendeuse(int $vendeuseId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM produits
              WHERE vendeuse_id = ? AND actif = 1 AND quantite_disponible > 0
           ORDER BY categorie, nom'
        );
        $stmt->execute([$vendeuseId]);
        return $stmt->fetchAll();
    }

    /** Tous les produits d'une vendeuse (vue gestion, y compris épuisés). */
    public function parVendeuse(int $vendeuseId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM produits WHERE vendeuse_id = ? ORDER BY actif DESC, nom'
        );
        $stmt->execute([$vendeuseId]);
        return $stmt->fetchAll();
    }

    public function trouver(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM produits WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function creer(array $d): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO produits (vendeuse_id, nom, description, categorie, prix_xof, unite, quantite_disponible, photo)
             VALUES (:vendeuse_id, :nom, :description, :categorie, :prix, :unite, :qte, :photo)'
        );
        $stmt->execute([
            ':vendeuse_id' => $d['vendeuse_id'],
            ':nom'         => $d['nom'],
            ':description' => $d['description'] ?? null,
            ':categorie'   => $d['categorie'] ?? null,
            ':prix'        => $d['prix_xof'],
            ':unite'       => $d['unite'],
            ':qte'         => $d['quantite_disponible'],
            ':photo'       => $d['photo'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function modifier(int $id, int $vendeuseId, array $d): void
    {
        $stmt = $this->db->prepare(
            'UPDATE produits
                SET nom = :nom, description = :description, categorie = :categorie,
                    prix_xof = :prix, unite = :unite, quantite_disponible = :qte, actif = :actif
              WHERE id = :id AND vendeuse_id = :vendeuse_id'
        );
        $stmt->execute([
            ':nom'         => $d['nom'],
            ':description' => $d['description'] ?? null,
            ':categorie'   => $d['categorie'] ?? null,
            ':prix'        => $d['prix_xof'],
            ':unite'       => $d['unite'],
            ':qte'         => $d['quantite_disponible'],
            ':actif'       => $d['actif'] ?? 1,
            ':id'          => $id,
            ':vendeuse_id' => $vendeuseId,
        ]);
    }

    public function enregistrerPhoto(int $id, string $chemin): void
    {
        $stmt = $this->db->prepare('UPDATE produits SET photo = ? WHERE id = ?');
        $stmt->execute([$chemin, $id]);
    }

    /** Décrémente le stock lors d'une commande (jamais négatif). */
    public function decrementerStock(int $id, int $quantite): void
    {
        $stmt = $this->db->prepare(
            'UPDATE produits
                SET quantite_disponible = GREATEST(0, quantite_disponible - ?)
              WHERE id = ?'
        );
        $stmt->execute([$quantite, $id]);
    }

    public function supprimer(int $id, int $vendeuseId): void
    {
        $stmt = $this->db->prepare('DELETE FROM produits WHERE id = ? AND vendeuse_id = ?');
        $stmt->execute([$id, $vendeuseId]);
    }
}
