<?php
/* ==========================================================================
   controllers/CoachController.php — Catalogue coachs, profil, mise à jour.
   ========================================================================== */

class CoachController
{
    /** GET /coachs?texte=&specialite=&commune=&langue=&noteMin=&prixMax=&tri= */
    public function index(array $params): void
    {
        $filtres = [
            'texte'      => Request::query('texte'),
            'specialite' => Request::query('specialite'),
            'commune'    => Request::query('commune'),
            'langue'     => Request::query('langue'),
            'noteMin'    => Request::query('noteMin'),
            'prixMax'    => Request::query('prixMax'),
            'tri'        => Request::query('tri', 'trust'),
        ];
        Response::ok((new Coach())->rechercher($filtres));
    }

    /** GET /coachs/:id */
    public function show(array $params): void
    {
        $coach = (new Coach())->complet($params['id']);
        if (!$coach) {
            Response::erreur('Coach introuvable.', 404);
        }
        Response::ok($coach);
    }

    /** GET /coachs/moi — fiche du coach connecté. */
    public function moi(array $params): void
    {
        $user = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        if (!$coach) {
            Response::erreur('Fiche coach introuvable.', 404);
        }
        Response::ok($coach);
    }

    /** PATCH /coachs/moi — met à jour la fiche du coach connecté. */
    public function majMoi(array $params): void
    {
        $user = Auth::exigerRole('coach');
        $model = new Coach();
        $coach = $model->parProprietaire((int) $user['id']);
        if (!$coach) {
            Response::erreur('Fiche coach introuvable.', 404);
        }
        $d = Request::corps();
        $champs = array_intersect_key($d, array_flip(['titre', 'bio', 'commune', 'photo', 'couverture']));
        if ($champs) {
            $model->maj($coach['id'], $champs);
        }
        Response::ok($model->complet($coach['id']));
    }
}
