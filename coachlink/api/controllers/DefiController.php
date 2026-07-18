<?php
/* ==========================================================================
   controllers/DefiController.php — Défis coach → client.
   ========================================================================== */

class DefiController
{
    /** POST /defis — le coach lance un défi à un client. */
    public function creer(array $params): void
    {
        $user  = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        if (!$coach) { Response::erreur('Profil coach introuvable.', 404); }
        $d = Request::corps();
        (new Validator($d))->requis('clientId')->requis('titre')->ouEchouer();
        $defi = (new Defi())->creer([
            'coachId' => $coach['id'], 'coachNom' => $coach['prenom'] . ' ' . $coach['nom'],
            'clientId' => (int) $d['clientId'], 'clientNom' => $d['clientNom'] ?? '',
            'titre' => $d['titre'], 'description' => $d['description'] ?? '', 'echeance' => $d['echeance'] ?? '',
        ]);
        (new Notification())->ajouter((int) $d['clientId'], 'info',
            'Nouveau défi de ' . $coach['prenom'] . ' : « ' . $d['titre'] . ' »', '#/client');
        Response::ok($defi, 201);
    }

    /** GET /defis/mes — défis du client connecté. */
    public function mes(array $params): void
    {
        $user = Auth::exigerRole('client');
        Response::ok((new Defi())->parClient((int) $user['id']));
    }

    /** GET /defis/coach — défis lancés par le coach connecté. */
    public function coach(array $params): void
    {
        $user  = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        Response::ok($coach ? (new Defi())->parCoach($coach['id']) : []);
    }

    /** PATCH /defis/:id/statut  { statut } — le client valide (reussi/echoue). */
    public function statut(array $params): void
    {
        $user  = Auth::exigerRole('client');
        $model = new Defi();
        $defi  = $model->trouver((int) $params['id']);
        if (!$defi || (int) $defi['client_id'] !== (int) $user['id']) { Response::erreur('Défi introuvable.', 404); }
        $statut = Request::champ('statut');
        if (!in_array($statut, ['reussi', 'echoue', 'propose'], true)) { Response::erreur('Statut invalide.', 422); }
        $defi = $model->changerStatut((int) $params['id'], $statut);
        $coach = (new Coach())->trouver($defi['coach_id']);
        if ($coach && $coach['proprietaire']) {
            (new Notification())->ajouter((int) $coach['proprietaire'], 'info',
                $defi['client_nom'] . ' a ' . ($statut === 'reussi' ? 'réussi' : 'abandonné') . ' le défi « ' . $defi['titre'] . ' ».', '#/espace-coach');
        }
        Response::ok($defi);
    }
}
