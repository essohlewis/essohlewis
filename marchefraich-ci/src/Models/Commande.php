<?php

declare(strict_types=1);

namespace App\Models;

use RuntimeException;

class Commande extends Model
{
    /**
     * Crée une commande complète (transactionnelle) à partir d'un panier.
     *
     * Le panier est un tableau [produit_id => quantite]. Les prix sont
     * relus en base (jamais depuis le client) et le stock est décrémenté.
     * Toute la vente concerne une seule vendeuse au MVP.
     *
     * @param array<int,int> $panier
     * @return array{id:int,reference:string} Identifiants de la commande créée
     */
    public function creerDepuisPanier(
        int $clientId,
        int $vendeuseId,
        int $marcheId,
        array $panier,
        string $modePaiement,
        string $adresse,
        string $quartier,
        string $notes,
        float $tauxCommission,
        int $fraisLivraison
    ): array {
        if ($panier === []) {
            throw new RuntimeException('Le panier est vide.');
        }

        $produitModel = new Produit();
        $lignes = [];
        $montantProduits = 0;

        // Relecture des produits et vérification du stock.
        foreach ($panier as $produitId => $quantite) {
            $quantite = (int) $quantite;
            if ($quantite <= 0) {
                continue;
            }
            $produit = $produitModel->trouver((int) $produitId);
            if ($produit === null || (int) $produit['actif'] !== 1) {
                throw new RuntimeException('Un produit du panier n\'est plus disponible.');
            }
            if ((int) $produit['vendeuse_id'] !== $vendeuseId) {
                throw new RuntimeException('Le panier mélange plusieurs vendeuses.');
            }
            if ((int) $produit['quantite_disponible'] < $quantite) {
                throw new RuntimeException(
                    'Stock insuffisant pour « ' . $produit['nom'] . ' ».'
                );
            }
            $sousTotal = (int) $produit['prix_xof'] * $quantite;
            $montantProduits += $sousTotal;
            $lignes[] = [
                'produit_id'        => (int) $produit['id'],
                'nom_produit'       => $produit['nom'],
                'prix_unitaire_xof' => (int) $produit['prix_xof'],
                'quantite'          => $quantite,
                'sous_total_xof'    => $sousTotal,
            ];
        }

        if ($lignes === []) {
            throw new RuntimeException('Aucun produit valide dans le panier.');
        }

        $commission = (int) round($montantProduits * $tauxCommission / 100);
        // Le client paie les produits + la livraison. La commission est
        // une part prélevée par la plateforme sur le montant des produits.
        $montantTotal = $montantProduits + $fraisLivraison;

        $this->db->beginTransaction();
        try {
            $reference = $this->genererReference();
            $stmt = $this->db->prepare(
                'INSERT INTO commandes
                    (reference, client_id, vendeuse_id, marche_id, montant_produits_xof,
                     frais_livraison_xof, commission_xof, montant_total_xof,
                     mode_paiement, statut_paiement, adresse_livraison, quartier_livraison, notes)
                 VALUES
                    (:ref, :client, :vendeuse, :marche, :mp, :fl, :com, :total,
                     :mode, :sp, :adresse, :quartier, :notes)'
            );
            $stmt->execute([
                ':ref'      => $reference,
                ':client'   => $clientId,
                ':vendeuse' => $vendeuseId,
                ':marche'   => $marcheId,
                ':mp'       => $montantProduits,
                ':fl'       => $fraisLivraison,
                ':com'      => $commission,
                ':total'    => $montantTotal,
                ':mode'     => $modePaiement,
                ':sp'       => 'en_attente', // confirmé ensuite (paiement ou livraison)
                ':adresse'  => $adresse,
                ':quartier' => $quartier !== '' ? $quartier : null,
                ':notes'    => $notes !== '' ? $notes : null,
            ]);
            $commandeId = (int) $this->db->lastInsertId();

            $stmtLigne = $this->db->prepare(
                'INSERT INTO lignes_commande
                    (commande_id, produit_id, nom_produit, prix_unitaire_xof, quantite, sous_total_xof)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            foreach ($lignes as $l) {
                $stmtLigne->execute([
                    $commandeId,
                    $l['produit_id'],
                    $l['nom_produit'],
                    $l['prix_unitaire_xof'],
                    $l['quantite'],
                    $l['sous_total_xof'],
                ]);
                $produitModel->decrementerStock($l['produit_id'], $l['quantite']);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return ['id' => $commandeId, 'reference' => $reference];
    }

    private function genererReference(): string
    {
        // Référence lisible et unique : MF-AAAAMMJJ-XXXXXX
        return 'MF-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
    }

    public function trouver(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT c.*, cl.nom AS client_nom, cl.telephone AS client_tel,
                    v.nom AS vendeuse_nom, v.telephone AS vendeuse_tel,
                    m.nom AS marche_nom, co.nom AS coursier_nom, co.telephone AS coursier_tel
               FROM commandes c
               JOIN clients cl   ON cl.id = c.client_id
               JOIN vendeuses v  ON v.id  = c.vendeuse_id
               JOIN marches m    ON m.id  = c.marche_id
          LEFT JOIN coursiers co ON co.id = c.coursier_id
              WHERE c.id = ?'
        );
        $stmt->execute([$id]);
        $commande = $stmt->fetch();
        return $commande ?: null;
    }

    public function parReference(string $reference): ?array
    {
        $stmt = $this->db->prepare('SELECT id FROM commandes WHERE reference = ?');
        $stmt->execute([$reference]);
        $row = $stmt->fetch();
        return $row ? $this->trouver((int) $row['id']) : null;
    }

    /** @return array<int,array<string,mixed>> Lignes détaillées d'une commande. */
    public function lignes(int $commandeId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM lignes_commande WHERE commande_id = ? ORDER BY id'
        );
        $stmt->execute([$commandeId]);
        return $stmt->fetchAll();
    }

    public function parClient(int $clientId): array
    {
        $stmt = $this->db->prepare(
            'SELECT c.*, v.nom AS vendeuse_nom
               FROM commandes c JOIN vendeuses v ON v.id = c.vendeuse_id
              WHERE c.client_id = ? ORDER BY c.cree_le DESC'
        );
        $stmt->execute([$clientId]);
        return $stmt->fetchAll();
    }

    /** Commandes d'une vendeuse, filtrables par "aujourd'hui". */
    public function parVendeuse(int $vendeuseId, bool $aujourdhui = false): array
    {
        $sql = 'SELECT c.*, cl.nom AS client_nom, cl.telephone AS client_tel
                  FROM commandes c JOIN clients cl ON cl.id = c.client_id
                 WHERE c.vendeuse_id = ?';
        if ($aujourdhui) {
            $sql .= ' AND DATE(c.cree_le) = CURDATE()';
        }
        $sql .= ' ORDER BY c.cree_le DESC';
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$vendeuseId]);
        return $stmt->fetchAll();
    }

    /** Chiffre du jour d'une vendeuse (hors commandes annulées). */
    public function revenusDuJour(int $vendeuseId): array
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) AS nb, COALESCE(SUM(montant_produits_xof), 0) AS total
               FROM commandes
              WHERE vendeuse_id = ? AND DATE(cree_le) = CURDATE() AND statut <> "annulee"'
        );
        $stmt->execute([$vendeuseId]);
        return $stmt->fetch() ?: ['nb' => 0, 'total' => 0];
    }

    /** Courses prêtes à livrer et non encore attribuées (vue coursier). */
    public function coursesDisponibles(): array
    {
        return $this->db->query(
            'SELECT c.*, v.nom AS vendeuse_nom, m.nom AS marche_nom, m.quartier AS marche_quartier
               FROM commandes c
               JOIN vendeuses v ON v.id = c.vendeuse_id
               JOIN marches m   ON m.id = c.marche_id
              WHERE c.coursier_id IS NULL
                AND c.statut IN ("recue","en_preparation")
           ORDER BY c.cree_le ASC'
        )->fetchAll();
    }

    /** Courses attribuées à un coursier et non terminées. */
    public function coursesDuCoursier(int $coursierId): array
    {
        $stmt = $this->db->prepare(
            'SELECT c.*, v.nom AS vendeuse_nom, cl.nom AS client_nom, cl.telephone AS client_tel,
                    m.quartier AS marche_quartier
               FROM commandes c
               JOIN vendeuses v ON v.id = c.vendeuse_id
               JOIN clients cl  ON cl.id = c.client_id
               JOIN marches m   ON m.id = c.marche_id
              WHERE c.coursier_id = ?
           ORDER BY FIELD(c.statut,"en_livraison","en_preparation","recue","livree","annulee"), c.cree_le DESC'
        );
        $stmt->execute([$coursierId]);
        return $stmt->fetchAll();
    }

    /**
     * Un coursier accepte une course (attribution atomique : le premier
     * qui accepte l'obtient, évite la double-attribution).
     * @return bool true si la course a bien été attribuée.
     */
    public function accepterCourse(int $commandeId, int $coursierId): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE commandes
                SET coursier_id = ?, statut = "en_livraison"
              WHERE id = ? AND coursier_id IS NULL AND statut IN ("recue","en_preparation")'
        );
        $stmt->execute([$coursierId, $commandeId]);
        return $stmt->rowCount() > 0;
    }

    /** Change le statut d'une commande (transitions autorisées vérifiées en amont). */
    public function definirStatut(int $commandeId, string $statut): void
    {
        $stmt = $this->db->prepare('UPDATE commandes SET statut = ? WHERE id = ?');
        $stmt->execute([$statut, $commandeId]);

        // À la livraison d'une commande payée en espèces, on marque le paiement reçu.
        if ($statut === 'livree') {
            $this->db->prepare(
                'UPDATE commandes SET statut_paiement = "paye"
                  WHERE id = ? AND mode_paiement = "especes"'
            )->execute([$commandeId]);
        }
    }

    public function definirStatutPaiement(int $commandeId, string $statut): void
    {
        $stmt = $this->db->prepare('UPDATE commandes SET statut_paiement = ? WHERE id = ?');
        $stmt->execute([$statut, $commandeId]);
    }

    /** Statistiques globales pour le tableau de bord admin. */
    public function statistiques(): array
    {
        return $this->db->query(
            'SELECT
                COUNT(*) AS total_commandes,
                COALESCE(SUM(CASE WHEN statut = "livree" THEN 1 ELSE 0 END), 0) AS livrees,
                COALESCE(SUM(CASE WHEN statut = "livree" THEN commission_xof ELSE 0 END), 0) AS commissions,
                COALESCE(SUM(CASE WHEN statut = "livree" THEN montant_total_xof ELSE 0 END), 0) AS volume
               FROM commandes'
        )->fetch() ?: [];
    }
}
