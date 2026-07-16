<?php
/* ==========================================================================
   models/Reservation.php — Réservations + paiement Mobile Money simulé.
   ========================================================================== */

class Reservation extends Model
{
    protected string $table = 'reservations';

    public function parClient(int $clientId): array
    {
        return $this->ou(['client_id' => $clientId], 'cree_le DESC');
    }

    public function parCoach(string $coachId): array
    {
        return $this->ou(['coach_id' => $coachId], 'cree_le DESC');
    }

    public function creer(array $d): array
    {
        $id = $this->inserer([
            'coach_id'   => $d['coachId'],
            'client_id'  => $d['clientId'],
            'client_nom' => $d['clientNom'],
            'tarif_id'   => $d['tarifId'],
            'tarif_nom'  => $d['tarifNom'],
            'prix'       => $d['prix'],
            'duree'      => $d['duree'] ?? 60,
            'jour'       => $d['jour'],
            'heure'      => $d['heure'],
            'message'    => $d['message'] ?? '',
            'statut'     => 'en_attente',
            'cree_le'    => date('c'),
        ]);
        return $this->trouver($id);
    }

    /** Enregistre le paiement (avec remise promo éventuelle). */
    public function payer(int $id, array $p): array
    {
        $resa = $this->trouver($id);
        $remise = 0;
        if (!empty($p['promoTaux'])) {
            $remise = (int) round(($resa['prix'] * $p['promoTaux']) / 100);
        }
        $montant = $resa['prix'] - $remise;
        $this->maj($id, [
            'paye'             => 1,
            'paiement_op'      => $p['operateur'],
            'paiement_numero'  => $p['numero'],
            'paiement_montant' => $montant,
            'paiement_remise'  => $remise,
            'paiement_promo'   => $p['promoCode'] ?? null,
            'paiement_ref'     => 'MM' . substr((string) (time() . random_int(10, 99)), -8),
            'paiement_date'    => date('c'),
        ]);
        return $this->trouver($id);
    }

    public function changerStatut(int $id, string $statut): void
    {
        $this->maj($id, ['statut' => $statut]);
    }
}
