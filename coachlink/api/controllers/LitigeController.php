<?php
/* ==========================================================================
   controllers/LitigeController.php — Ouverture d'un litige par un utilisateur.
   ========================================================================== */

class LitigeController
{
    /** POST /litiges  { coachNom, motif } */
    public function ouvrir(array $params): void
    {
        $user = Auth::exiger();
        $d = Request::corps();
        (new Validator($d))->requis('motif', 'Décrivez le problème rencontré.')->ouEchouer();

        $litige = (new Litige())->ouvrir([
            'clientId'  => (int) $user['id'],
            'clientNom' => $user['prenom'] . ' ' . $user['nom'],
            'coachNom'  => $d['coachNom'] ?? '',
            'motif'     => $d['motif'],
        ]);
        Response::ok($litige, 201);
    }
}
