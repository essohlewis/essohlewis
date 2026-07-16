<?php
/* ==========================================================================
   controllers/ReservationController.php — Réservations & paiement.
   ========================================================================== */

class ReservationController
{
    /** POST /reservations */
    public function creer(array $params): void
    {
        $user = Auth::exigerRole('client');
        $d = Request::corps();
        (new Validator($d))
            ->requis('coachId')->requis('tarifId')->requis('jour')->requis('heure')
            ->ouEchouer();

        $d['clientId']  = (int) $user['id'];
        $d['clientNom'] = $user['prenom'] . ' ' . $user['nom'];
        $resa = (new Reservation())->creer($d);

        // Notifie le coach.
        $coach = (new Coach())->trouver($d['coachId']);
        if ($coach && $coach['proprietaire']) {
            (new Notification())->ajouter((int) $coach['proprietaire'], 'reservation',
                $d['clientNom'] . ' a demandé « ' . $resa['tarif_nom'] . ' ».', '#/espace-coach/reservations');
        }
        Response::ok($resa, 201);
    }

    /** GET /reservations/mes — réservations du client connecté. */
    public function mes(array $params): void
    {
        $user = Auth::exiger();
        Response::ok((new Reservation())->parClient((int) $user['id']));
    }

    /** GET /reservations/coach — demandes reçues par le coach connecté. */
    public function pourCoach(array $params): void
    {
        $user = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        Response::ok($coach ? (new Reservation())->parCoach($coach['id']) : []);
    }

    /** POST /reservations/:id/payer */
    public function payer(array $params): void
    {
        $user = Auth::exigerRole('client');
        $model = new Reservation();
        $resa = $model->trouver((int) $params['id']);
        if (!$resa || (int) $resa['client_id'] !== (int) $user['id']) {
            Response::erreur('Réservation introuvable.', 404);
        }
        $d = Request::corps();
        if (!preg_match('/^\d{4}$/', (string) ($d['code'] ?? ''))) {
            Response::erreur('Code de confirmation invalide (4 chiffres).', 422);
        }
        $resa = $model->payer((int) $params['id'], $d);

        $coach = (new Coach())->trouver($resa['coach_id']);
        if ($coach && $coach['proprietaire']) {
            (new Notification())->ajouter((int) $coach['proprietaire'], 'paiement',
                $resa['client_nom'] . ' a payé « ' . $resa['tarif_nom'] . ' ».', '#/espace-coach/reservations');
        }
        Response::ok($resa);
    }

    /** PATCH /reservations/:id/statut  { statut } */
    public function statut(array $params): void
    {
        $user = Auth::exiger();
        $model = new Reservation();
        $resa = $model->trouver((int) $params['id']);
        if (!$resa) {
            Response::erreur('Réservation introuvable.', 404);
        }
        $statut = Request::champ('statut');
        $autorises = ['confirmee', 'refusee', 'terminee', 'annulee'];
        if (!in_array($statut, $autorises, true)) {
            Response::erreur('Statut invalide.', 422);
        }
        $model->changerStatut((int) $params['id'], $statut);

        // Notifications selon le nouveau statut.
        $notif = new Notification();
        $coach = (new Coach())->trouver($resa['coach_id']);
        if ($statut === 'confirmee') {
            $notif->ajouter((int) $resa['client_id'], 'confirmation', 'Votre séance « ' . $resa['tarif_nom'] . ' » est confirmée !', '#/client/reservations');
        } elseif ($statut === 'refusee') {
            $notif->ajouter((int) $resa['client_id'], 'refus', 'Votre demande « ' . $resa['tarif_nom'] . ' » a été refusée.', '#/client/reservations');
        } elseif ($statut === 'terminee') {
            $notif->ajouter((int) $resa['client_id'], 'info', 'Séance « ' . $resa['tarif_nom'] . ' » terminée. Laissez un avis à votre coach !', '#/client/avis');
        } elseif ($statut === 'annulee' && $coach && $coach['proprietaire']) {
            $notif->ajouter((int) $coach['proprietaire'], 'annulation', $resa['client_nom'] . ' a annulé « ' . $resa['tarif_nom'] . ' ».', '#/espace-coach/reservations');
        }
        Response::ok($model->trouver((int) $params['id']));
    }
}
