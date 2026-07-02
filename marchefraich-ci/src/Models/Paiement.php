<?php

declare(strict_types=1);

namespace App\Models;

class Paiement extends Model
{
    public function creer(int $commandeId, int $montant, string $methode, string $statut = 'en_attente', ?string $reference = null): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO paiements (commande_id, montant_xof, methode, statut, reference_operateur)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$commandeId, $montant, $methode, $statut, $reference]);
        return (int) $this->db->lastInsertId();
    }

    public function definirStatut(int $id, string $statut, ?string $reference = null): void
    {
        $stmt = $this->db->prepare(
            'UPDATE paiements SET statut = ?, reference_operateur = COALESCE(?, reference_operateur) WHERE id = ?'
        );
        $stmt->execute([$statut, $reference, $id]);
    }

    public function parCommande(int $commandeId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM paiements WHERE commande_id = ? ORDER BY cree_le DESC'
        );
        $stmt->execute([$commandeId]);
        return $stmt->fetchAll();
    }
}
