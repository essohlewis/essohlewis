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

        // Retraits vers Mobile Money (débits).
        foreach ((new Portefeuille())->parCoach($coach['id']) as $rt) {
            $ops[] = [
                'type'      => 'retrait',
                'libelle'   => 'Retrait ' . $rt['operateur'] . ' — ' . $rt['numero'],
                'montant'   => -(int) $rt['montant'],
                'reference' => $rt['reference'],
                'date'      => $rt['date'],
            ];
        }

        usort($ops, fn($a, $b) => strcmp((string) $b['date'], (string) $a['date']));
        $solde = array_sum(array_map(fn($o) => $o['montant'], $ops));

        Response::ok(['solde' => $solde, 'operations' => $ops]);
    }

    /** POST /portefeuille/retrait — le coach retire vers Mobile Money. */
    public function retrait(array $params): void
    {
        $user  = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        if (!$coach) {
            Response::erreur('Profil coach introuvable.', 404);
        }
        $d       = Request::corps();
        $montant = (int) ($d['montant'] ?? 0);
        $op      = trim((string) ($d['operateur'] ?? ''));
        $numero  = trim((string) ($d['numero'] ?? ''));

        if ($montant < 500) {
            Response::erreur('Montant minimum de retrait : 500 FCFA.', 422);
        }
        if ($numero === '') {
            Response::erreur('Numéro Mobile Money requis.', 422);
        }
        $solde = $this->solde($coach['id']);
        if ($montant > $solde) {
            Response::erreur('Solde insuffisant.', 422);
        }

        // Décaissement via la passerelle (simulateur par défaut) → référence.
        $tx = PaiementService::pour($op)->initier([
            'referenceInterne' => 'RT' . time(),
            'montant'          => $montant,
            'operateur'        => $op,
            'numero'           => $numero,
            'code'             => $d['code'] ?? '0000',
            'description'      => 'CoachLink CI — retrait portefeuille',
        ]);
        $ref = $tx['reference'] ?? ('RT' . substr((string) time(), -8));
        (new Portefeuille())->enregistrerRetrait($coach['id'], $montant, $op, $numero, $ref);

        (new Notification())->ajouter((int) $user['id'], 'paiement',
            'Retrait de ' . number_format($montant, 0, ',', ' ') . ' FCFA vers ' . $op . ' effectué.', '#/espace-coach/portefeuille');

        $this->coach($params); // renvoie le solde + opérations à jour
    }

    /** Solde courant (crédits validés + règlements − retraits). */
    private function solde(string $coachId): int
    {
        $model  = new Reservation();
        $credit = 0;
        foreach ($model->requete("SELECT * FROM reservations WHERE coach_id = ? AND presence_validee = 1", [$coachId]) as $r) {
            $credit += (int) ($r['paye'] ? ($r['paiement_montant'] ?: $r['prix']) : $r['prix']);
        }
        foreach ($model->requete("SELECT ap.montant FROM abonnement_paiements ap JOIN abonnements a ON a.id = ap.abonnement_id WHERE a.coach_id = ?", [$coachId]) as $p) {
            $credit += (int) $p['montant'];
        }
        $debit = 0;
        foreach ((new Portefeuille())->parCoach($coachId) as $rt) {
            $debit += (int) $rt['montant'];
        }
        return $credit - $debit;
    }
}
