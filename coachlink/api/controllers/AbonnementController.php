<?php
/* ==========================================================================
   controllers/AbonnementController.php — Abonnements mensuels.
   ========================================================================== */

class AbonnementController
{
    /** POST /abonnements — le client demande un abonnement à un coach. */
    public function creer(array $params): void
    {
        $user = Auth::exigerRole('client');
        $d = Request::corps();
        (new Validator($d))->requis('coachId')->requis('objectif')->ouEchouer();

        $coach = (new Coach())->trouver($d['coachId']);
        if (!$coach) {
            Response::erreur('Coach introuvable.', 404);
        }
        $d['clientId']  = (int) $user['id'];
        $d['clientNom'] = $user['prenom'] . ' ' . $user['nom'];
        $d['coachNom']  = $coach['prenom'] . ' ' . $coach['nom'];

        $abo = (new Abonnement())->creer($d);

        if ($coach['proprietaire']) {
            (new Notification())->ajouter((int) $coach['proprietaire'], 'abonnement',
                $d['clientNom'] . ' souhaite un abonnement mensuel (' . $abo['seances_semaine'] . ' séance(s)/sem.).',
                '#/espace-coach/abonnements');
        }
        Response::ok($abo, 201);
    }

    /** GET /abonnements/mes — abonnements du client. */
    public function mes(array $params): void
    {
        $user = Auth::exiger();
        Response::ok((new Abonnement())->parClient((int) $user['id']));
    }

    /** GET /abonnements/coach — demandes reçues par le coach. */
    public function pourCoach(array $params): void
    {
        $user  = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        Response::ok($coach ? (new Abonnement())->parCoach($coach['id']) : []);
    }

    /** GET /abonnements/:id */
    public function show(array $params): void
    {
        $user = Auth::exiger();
        $abo  = (new Abonnement())->complet((int) $params['id']);
        if (!$abo || !$this->peutVoir($user, $abo)) {
            Response::erreur('Abonnement introuvable.', 404);
        }
        Response::ok($abo);
    }

    /** PATCH /abonnements/:id/programme — le coach fixe le programme + prix. */
    public function programme(array $params): void
    {
        $user  = Auth::exigerRole('coach');
        $model = new Abonnement();
        $abo   = $model->trouver((int) $params['id']);
        if (!$abo || !$this->estLeCoach($user, $abo)) {
            Response::erreur('Abonnement introuvable.', 404);
        }
        $abo = $model->definirProgramme((int) $params['id'], Request::corps());

        (new Notification())->ajouter((int) $abo['client_id'], 'abonnement',
            'Votre coach a préparé votre programme mensuel (' . number_format($abo['prix_mensuel'], 0, ',', ' ') . ' FCFA).',
            '#/client/abonnements');
        Response::ok($abo);
    }

    /** PATCH /abonnements/:id/statut  { statut } */
    public function statut(array $params): void
    {
        $user   = Auth::exiger();
        $model  = new Abonnement();
        $abo    = $model->trouver((int) $params['id']);
        $statut = Request::champ('statut');
        if (!$abo || !$this->peutVoir($user, $abo)) {
            Response::erreur('Abonnement introuvable.', 404);
        }
        if (!in_array($statut, ['propose', 'actif', 'termine', 'annule'], true)) {
            Response::erreur('Statut invalide.', 422);
        }
        $model->changerStatut((int) $params['id'], $statut);

        // Notifie l'autre partie.
        $coach = (new Coach())->trouver($abo['coach_id']);
        if ($statut === 'annule') {
            $dest = (int) $user['id'] === (int) $abo['client_id'] ? (int) ($coach['proprietaire'] ?? 0) : (int) $abo['client_id'];
            if ($dest) {
                (new Notification())->ajouter($dest, 'abonnement', 'Un abonnement a été annulé.', '#/client/abonnements');
            }
        }
        Response::ok($model->complet((int) $params['id']));
    }

    /** POST /abonnements/:id/payer — règlement mensuel (Mobile Money). */
    public function payer(array $params): void
    {
        $user  = Auth::exigerRole('client');
        $model = new Abonnement();
        $abo   = $model->trouver((int) $params['id']);
        if (!$abo || (int) $abo['client_id'] !== (int) $user['id']) {
            Response::erreur('Abonnement introuvable.', 404);
        }
        if ((int) $abo['prix_mensuel'] <= 0 || $abo['statut'] === 'demande') {
            Response::erreur('Le programme n\'est pas encore proposé par le coach.', 409);
        }

        $d    = Request::corps();
        $mois = $d['mois'] ?? date('Y-m');
        if ($model->moisRegle((int) $params['id'], $mois)) {
            Response::erreur('Ce mois est déjà réglé.', 409);
        }

        $tx = PaiementService::pour($d['operateur'] ?? '')->initier([
            'referenceInterne' => 'abo-' . $params['id'],
            'montant'          => (int) $abo['prix_mensuel'],
            'operateur'        => $d['operateur'] ?? '',
            'numero'           => $d['numero'] ?? '',
            'code'             => $d['code'] ?? null,
            'description'      => 'CoachLink CI — abonnement mensuel',
        ]);
        if ($tx['statut'] === 'echoue') {
            Response::erreur($tx['message'] ?? 'Paiement refusé.', 402);
        }
        if ($tx['statut'] === 'en_attente') {
            Response::ok(['paiement_statut' => 'en_attente', 'reference' => $tx['reference'],
                          'lien' => $tx['lien'] ?? null, 'message' => $tx['message'] ?? ''], 202);
        }

        // Succès : enregistre le mois + active l'abonnement si besoin.
        $model->enregistrerPaiement((int) $params['id'], [
            'mois' => $mois, 'montant' => (int) $abo['prix_mensuel'],
            'operateur' => $d['operateur'] ?? '', 'reference' => $tx['reference'],
        ]);
        if ($abo['statut'] !== 'actif') {
            $model->changerStatut((int) $params['id'], 'actif');
        }

        $coach = (new Coach())->trouver($abo['coach_id']);
        if ($coach && $coach['proprietaire']) {
            (new Notification())->ajouter((int) $coach['proprietaire'], 'paiement',
                $abo['client_nom'] . ' a réglé son abonnement (' . $mois . ').', '#/espace-coach/abonnements');
        }
        Response::ok($model->complet((int) $params['id']));
    }

    /* ------------------------------------------------------------------ */
    private function peutVoir(array $user, array $abo): bool
    {
        if ((int) $user['id'] === (int) $abo['client_id']) return true;
        return $this->estLeCoach($user, $abo);
    }

    private function estLeCoach(array $user, array $abo): bool
    {
        if (($user['role'] ?? '') !== 'coach') return false;
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        return $coach && $coach['id'] === $abo['coach_id'];
    }
}
