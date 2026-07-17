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

        // Calcule le montant net (avec remise promo éventuelle) pour la passerelle.
        $remise  = !empty($d['promoTaux']) ? (int) round(($resa['prix'] * $d['promoTaux']) / 100) : 0;
        $montant = (int) $resa['prix'] - $remise;

        // Initie le paiement via la passerelle de l'opérateur (simulateur par défaut).
        $tx = PaiementService::pour($d['operateur'] ?? '')->initier([
            'referenceInterne' => (int) $params['id'],
            'montant'          => $montant,
            'operateur'        => $d['operateur'] ?? '',
            'numero'           => $d['numero'] ?? '',
            'code'             => $d['code'] ?? null,
            'description'      => 'CoachLink CI — ' . $resa['tarif_nom'],
        ]);

        if ($tx['statut'] === 'echoue') {
            Response::erreur($tx['message'] ?? 'Paiement refusé.', 402);
        }

        if ($tx['statut'] === 'en_attente') {
            // Paiement réel initié : le client confirme sur son téléphone, la
            // réservation sera marquée payée par le webhook (/paiements/callback).
            // Clé dédiée « paiement_statut » (ne pas confondre avec le statut de
            // la réservation).
            Response::ok([
                'paiement_statut' => 'en_attente',
                'reference'       => $tx['reference'],
                'lien'            => $tx['lien'] ?? null,
                'message'         => $tx['message'] ?? 'Confirmez le paiement sur votre téléphone.',
            ], 202);
        }

        // Succès immédiat (simulateur) : on enregistre le paiement.
        $resa = $model->payer((int) $params['id'], array_merge($d, ['reference' => $tx['reference']]));

        $coach = (new Coach())->trouver($resa['coach_id']);
        if ($coach && $coach['proprietaire']) {
            (new Notification())->ajouter((int) $coach['proprietaire'], 'paiement',
                $resa['client_nom'] . ' a payé « ' . $resa['tarif_nom'] . ' ».', '#/espace-coach/reservations');
        }
        Response::ok($resa);
    }

    /** PATCH /reservations/:id/lieu — le coach ajuste le lieu du rendez-vous. */
    public function lieu(array $params): void
    {
        $user  = Auth::exigerRole('coach');
        $model = new Reservation();
        $resa  = $model->trouver((int) $params['id']);
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        if (!$resa || !$coach || $resa['coach_id'] !== $coach['id']) {
            Response::erreur('Réservation introuvable.', 404);
        }
        $d = Request::corps();
        $resa = $model->majLieu((int) $params['id'], $d);

        // Prévient le client de la précision / modification du lieu.
        (new Notification())->ajouter((int) $resa['client_id'], 'reservation',
            'Votre coach a précisé le lieu de « ' . $resa['tarif_nom'] .' ».', '#/client/reservations');
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
