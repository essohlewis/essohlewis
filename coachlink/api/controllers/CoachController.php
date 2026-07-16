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
        if (isset($d['specialites']) && is_array($d['specialites'])) {
            $model->majSpecialites($coach['id'], $d['specialites']);
        }
        if (isset($d['tarifs']) && is_array($d['tarifs'])) {
            $model->remplacerTarifs($coach['id'], $d['tarifs']);
        }
        Response::ok($model->complet($coach['id']));
    }

    /* ---------------- Gestion par le coach connecté ------------------ */

    private function monCoach(): array
    {
        $user = Auth::exigerRole('coach');
        $coach = (new Coach())->parProprietaire((int) $user['id']);
        if (!$coach) {
            Response::erreur('Fiche coach introuvable.', 404);
        }
        return $coach;
    }

    /** POST /coachs/moi/tarifs */
    public function ajouterTarif(array $params): void
    {
        $coach = $this->monCoach();
        (new Validator(Request::corps()))->requis('nom')->requis('prix')->ouEchouer();
        (new Coach())->ajouterTarif($coach['id'], Request::corps());
        Response::ok((new Coach())->complet($coach['id']), 201);
    }

    /** DELETE /tarifs/:id */
    public function supprimerTarif(array $params): void
    {
        $coach = $this->monCoach();
        (new Coach())->supprimerTarif($coach['id'], $params['id']);
        Response::ok(true);
    }

    /** PUT /coachs/moi/disponibilites  { dispo: {Lun:[..], ..} } */
    public function majDisponibilites(array $params): void
    {
        $coach = $this->monCoach();
        $dispo = Request::champ('dispo', []);
        (new Coach())->majDisponibilites($coach['id'], is_array($dispo) ? $dispo : []);
        Response::ok((new Coach())->complet($coach['id']));
    }

    /** POST /coachs/moi/diplomes */
    public function ajouterDiplome(array $params): void
    {
        $coach = $this->monCoach();
        (new Validator(Request::corps()))->requis('titre')->requis('ecole')->ouEchouer();
        (new Coach())->ajouterDiplome($coach['id'], Request::corps());
        Response::ok((new Coach())->complet($coach['id']), 201);
    }

    /** POST /coachs/moi/galerie  { image, legende } */
    public function ajouterMedia(array $params): void
    {
        $coach = $this->monCoach();
        (new Validator(Request::corps()))->requis('image', 'Image requise (URL ou data-URL)')->ouEchouer();
        (new Coach())->ajouterMedia($coach['id'], Request::corps());
        Response::ok((new Coach())->complet($coach['id']), 201);
    }

    /** DELETE /galerie/:id */
    public function supprimerMedia(array $params): void
    {
        $coach = $this->monCoach();
        (new Coach())->supprimerMedia($coach['id'], (int) $params['id']);
        Response::ok(true);
    }

    /** POST /coachs/moi/posts  { texte, image?, video? } */
    public function ajouterPost(array $params): void
    {
        $coach = $this->monCoach();
        $d = Request::corps();
        if (empty($d['texte']) && empty($d['image']) && empty($d['video'])) {
            Response::erreur('Publication vide.', 422);
        }
        (new Coach())->ajouterPost($coach['id'], $d);
        Response::ok((new Coach())->complet($coach['id']), 201);
    }

    /** DELETE /posts/:id */
    public function supprimerPost(array $params): void
    {
        $coach = $this->monCoach();
        (new Coach())->supprimerPost($coach['id'], (int) $params['id']);
        Response::ok(true);
    }

    /** POST /posts/:id/like — bascule le « J'aime » de l'utilisateur connecté. */
    public function basculerLike(array $params): void
    {
        $user = Auth::exiger();
        Response::ok((new Coach())->basculerLike((int) $params['id'], (int) $user['id']));
    }

    /** GET /mes-likes — identifiants des publications aimées par l'utilisateur. */
    public function mesLikes(array $params): void
    {
        $user = Auth::exiger();
        Response::ok((new Coach())->likesDe((int) $user['id']));
    }
}
