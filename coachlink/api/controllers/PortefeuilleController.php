<?php
/* ==========================================================================
   controllers/PortefeuilleController.php — Portefeuille du coach.
   Le solde est constitué (modèle séquestre) :
     • des séances ponctuelles dont la PRÉSENCE a été validée (QR scanné) ;
     • des règlements mensuels des abonnements du coach.
   Les fonds ne sont crédités qu'une fois la prestation prouvée / réglée.
   ========================================================================== */

class PortefeuilleController
{
    /** GET /portefeuille — solde + opérations du coach connecté. */
    public function coach(array $params): void
    {
        $user  = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        if (!$coach) {
            Response::ok(['solde' => 0, 'operations' => []]);
        }

        $model = new Reservation();
        $ops = [];

        // Séances dont la présence est validée → fonds libérés.
        $resas = $model->requete(
            "SELECT * FROM reservations WHERE coach_id = ? AND presence_validee = 1 ORDER BY presence_le DESC",
            [$coach['id']]
        );
        foreach ($resas as $r) {
            $montant = (int) ($r['paye'] ? ($r['paiement_montant'] ?: $r['prix']) : $r['prix']);
            $ops[] = [
                'type'      => 'seance',
                'libelle'   => $r['tarif_nom'] . ' — ' . $r['client_nom'],
                'montant'   => $montant,
                'reference' => $r['paiement_ref'] ?: ('SE' . $r['id']),
                'date'      => $r['presence_le'] ?: $r['cree_le'],
            ];
        }

        // Règlements mensuels d'abonnement.
        $paiements = $model->requete(
            "SELECT ap.*, a.client_nom, a.objectif FROM abonnement_paiements ap
             JOIN abonnements a ON a.id = ap.abonnement_id
             WHERE a.coach_id = ? ORDER BY ap.id DESC",
            [$coach['id']]
        );
        foreach ($paiements as $p) {
            $ops[] = [
                'type'      => 'abonnement',
                'libelle'   => 'Abonnement (' . $p['mois'] . ') — ' . $p['client_nom'],
                'montant'   => (int) $p['montant'],
                'reference' => $p['reference'],
                'date'      => $p['date'],
            ];
        }

        usort($ops, fn($a, $b) => strcmp((string) $b['date'], (string) $a['date']));
        $solde = array_sum(array_map(fn($o) => $o['montant'], $ops));

        Response::ok(['solde' => $solde, 'operations' => $ops]);
    }
}
