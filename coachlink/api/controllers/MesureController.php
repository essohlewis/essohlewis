<?php
/* ==========================================================================
   controllers/MesureController.php — Suivi santé / progrès du client.
   ========================================================================== */

class MesureController
{
    /** GET /mesures — mesures du client connecté. */
    public function mes(array $params): void
    {
        $user = Auth::exigerRole('client');
        Response::ok((new Mesure())->parClient((int) $user['id']));
    }

    /** POST /mesures — ajoute une mesure. */
    public function ajouter(array $params): void
    {
        $user = Auth::exigerRole('client');
        $d = Request::corps();
        $m = (new Mesure())->ajouter((int) $user['id'], $d);
        Response::ok($m, 201);
    }

    /** DELETE /mesures/:id — supprime une mesure. */
    public function supprimer(array $params): void
    {
        $user  = Auth::exigerRole('client');
        $model = new Mesure();
        $m = $model->trouver((int) $params['id']);
        if (!$m || (int) $m['client_id'] !== (int) $user['id']) { Response::erreur('Mesure introuvable.', 404); }
        $model->supprimer((int) $params['id']);
        Response::ok(['supprime' => true]);
    }
}
